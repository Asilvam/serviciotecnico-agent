param(
  [string]$PrinterName,

  [string]$DataPath,

  [string]$DocumentName,

  [int]$TimeoutSeconds = 15,

  [switch]$ValidateOnly
)

$ErrorActionPreference = "Stop"

Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;

public static class ServicioTecnicoRawPrinter
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public class DocInfo
    {
        [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
    }

    [DllImport("winspool.drv", EntryPoint = "OpenPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool OpenPrinter(string printerName, out IntPtr printerHandle, IntPtr defaults);

    [DllImport("winspool.drv", EntryPoint = "ClosePrinter", SetLastError = true)]
    private static extern bool ClosePrinter(IntPtr printerHandle);

    [DllImport("winspool.drv", EntryPoint = "StartDocPrinterW", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern int StartDocPrinter(IntPtr printerHandle, int level, [In] DocInfo documentInfo);

    [DllImport("winspool.drv", EntryPoint = "EndDocPrinter", SetLastError = true)]
    private static extern bool EndDocPrinter(IntPtr printerHandle);

    [DllImport("winspool.drv", EntryPoint = "StartPagePrinter", SetLastError = true)]
    private static extern bool StartPagePrinter(IntPtr printerHandle);

    [DllImport("winspool.drv", EntryPoint = "EndPagePrinter", SetLastError = true)]
    private static extern bool EndPagePrinter(IntPtr printerHandle);

    [DllImport("winspool.drv", EntryPoint = "WritePrinter", SetLastError = true)]
    private static extern bool WritePrinter(IntPtr printerHandle, byte[] bytes, int count, out int written);

    private static Win32Exception LastError()
    {
        return new Win32Exception(Marshal.GetLastWin32Error());
    }

    public static int Send(string printerName, string documentName, byte[] bytes)
    {
        IntPtr printerHandle;
        if (!OpenPrinter(printerName, out printerHandle, IntPtr.Zero))
        {
            throw LastError();
        }

        bool documentStarted = false;
        bool pageStarted = false;
        try
        {
            var documentInfo = new DocInfo
            {
                pDocName = documentName,
                pOutputFile = null,
                pDataType = "RAW"
            };
            int jobId = StartDocPrinter(printerHandle, 1, documentInfo);
            if (jobId == 0)
            {
                throw LastError();
            }
            documentStarted = true;

            if (!StartPagePrinter(printerHandle))
            {
                throw LastError();
            }
            pageStarted = true;

            int written;
            if (!WritePrinter(printerHandle, bytes, bytes.Length, out written))
            {
                throw LastError();
            }
            if (written != bytes.Length)
            {
                throw new InvalidOperationException("Windows escribió solo " + written + " de " + bytes.Length + " bytes.");
            }

            if (!EndPagePrinter(printerHandle))
            {
                throw LastError();
            }
            pageStarted = false;

            if (!EndDocPrinter(printerHandle))
            {
                throw LastError();
            }
            documentStarted = false;
            return jobId;
        }
        finally
        {
            if (pageStarted) EndPagePrinter(printerHandle);
            if (documentStarted) EndDocPrinter(printerHandle);
            ClosePrinter(printerHandle);
        }
    }
}
"@

if ($ValidateOnly) {
  Write-Output "Windows RAW spooler script OK"
  exit 0
}

try {
  if ([string]::IsNullOrWhiteSpace($PrinterName) -or
      [string]::IsNullOrWhiteSpace($DataPath) -or
      [string]::IsNullOrWhiteSpace($DocumentName)) {
    throw "PrinterName, DataPath and DocumentName are required."
  }

  if (-not (Test-Path -LiteralPath $DataPath -PathType Leaf)) {
    throw "No se encontró el archivo RAW temporal."
  }

  $bytes = [System.IO.File]::ReadAllBytes($DataPath)
  $jobId = [ServicioTecnicoRawPrinter]::Send(
    $PrinterName,
    $DocumentName,
    $bytes
  )
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  $lastStatus = "Enviado"

  while ([DateTime]::UtcNow -lt $deadline) {
    $job = Get-PrintJob -PrinterName $PrinterName -ID $jobId `
      -ErrorAction SilentlyContinue

    if ($null -eq $job) {
      Write-Output (@{
        jobId = $jobId
        status = "completed"
        lastStatus = $lastStatus
      } | ConvertTo-Json -Compress)
      exit 0
    }

    $lastStatus = [string]$job.JobStatus
    if ($lastStatus -match "Error|Offline|PaperOut|Blocked|UserIntervention|NotAvailable|ServerUnknown") {
      [Console]::Error.WriteLine(
        "La cola de Windows informó '$lastStatus' para el trabajo $jobId."
      )
      exit 2
    }
    if ($lastStatus -match "Completed|Printed") {
      Write-Output (@{
        jobId = $jobId
        status = "completed"
        lastStatus = $lastStatus
      } | ConvertTo-Json -Compress)
      exit 0
    }

    Start-Sleep -Milliseconds 250
  }

  [Console]::Error.WriteLine(
    "La cola de Windows mantuvo el trabajo $jobId en '$lastStatus' durante $TimeoutSeconds segundos."
  )
  exit 3
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
