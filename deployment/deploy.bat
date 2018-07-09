::::::::::::::::::::::::::::::::::::::::::::
:: Elevate.cmd - Version 4
:: Automatically check & get admin rights
::::::::::::::::::::::::::::::::::::::::::::
 @echo off
 CLS
 ECHO.
 ECHO =============================
 ECHO Running Admin shell
 ECHO =============================

:init
 setlocal DisableDelayedExpansion
 set cmdInvoke=1
 set winSysFolder=System32
 set "batchPath=%~0"
 for %%k in (%0) do set batchName=%%~nk
 set "vbsGetPrivileges=%temp%\OEgetPriv_%batchName%.vbs"
 setlocal EnableDelayedExpansion

:checkPrivileges
  NET FILE 1>NUL 2>NUL
  if '%errorlevel%' == '0' ( goto gotPrivileges ) else ( goto getPrivileges )

:getPrivileges
  if '%1'=='ELEV' (echo ELEV & shift /1 & goto gotPrivileges)
  ECHO.
  ECHO **************************************
  ECHO Invoking UAC for Privilege Escalation
  ECHO **************************************

  ECHO Set UAC = CreateObject^("Shell.Application"^) > "%vbsGetPrivileges%"
  ECHO args = "ELEV " >> "%vbsGetPrivileges%"
  ECHO For Each strArg in WScript.Arguments >> "%vbsGetPrivileges%"
  ECHO args = args ^& strArg ^& " "  >> "%vbsGetPrivileges%"
  ECHO Next >> "%vbsGetPrivileges%"

  if '%cmdInvoke%'=='1' goto InvokeCmd 

  ECHO UAC.ShellExecute "!batchPath!", args, "", "runas", 1 >> "%vbsGetPrivileges%"
  goto ExecElevation

:InvokeCmd
  ECHO args = "/c """ + "!batchPath!" + """ " + args >> "%vbsGetPrivileges%"
  ECHO UAC.ShellExecute "%SystemRoot%\%winSysFolder%\cmd.exe", args, "", "runas", 1 >> "%vbsGetPrivileges%"

:ExecElevation
 "%SystemRoot%\%winSysFolder%\WScript.exe" "%vbsGetPrivileges%" %*
 exit /B

:gotPrivileges
 setlocal & cd /d %~dp0
 if '%1'=='ELEV' (del "%vbsGetPrivileges%" 1>nul 2>nul  &  shift /1)
 echo RECEIVED ADMIN PERMISSIONS
 ::::::::::::::::::::::::::::
 ::START
 ::::::::::::::::::::::::::::
 REM Run shell as admin (example) - put here code as you like
 echo Fetching folder name to copy backup files...
 for /F "tokens=2" %%i in ('date /t') do set currentDate=%%~i
 set dateForFolder=%currentDate:/=%
 FOR /f "tokens=1 delims=." %%a IN ("%TIME%") do set currentTime=%%~a
 set timeForFolder=%currentTime::=%
 set folderName=%dateForFolder%_%timeForFolder%
 echo Backup Folder: %folderName%
 set /p appEnv= "Enter the application Environment to deploy (dev/qa/prod):"
 if '%appEnv%' == 'dev' goto XcopyDev
 if '%appEnv%' == 'qa' goto XcopyQA
 if '%appEnv%' == 'prod' goto XcopyProd
 :XcopyDev
	XCOPY E:\WebSites\TicketingSystemDevSite E:\WebSites\_backup\TicketingSystemDevSite\%folderName%\ /s /e
	goto StopServicesAfterBackup

 :XcopyQA
	XCOPY E:\WebSites\TicketingSystemQASite E:\WebSites\_backup\TicketingSystemQASite\%folderName%\ /s /e
	goto StopServicesAfterBackup

 :XcopyProd
	goto StopServicesAfterBackup

 :StopServicesAfterBackup
	echo Files have been copied successfully. Back up has been created successfully.
	set appcmdPath="C:\Windows\System32\inetsrv"
	cd /D %appcmdPath%
	if '%appEnv%' == 'dev' goto StopDevSite
	if '%appEnv%' == 'qa' goto StopQASite
	REM if '%appEnv%' == 'prod' goto StopProdSite
	
		:StopDevSite
		appcmd stop site TicketingSystemDevSite
		goto CopyNewFilesAfterServiceStop
		:StopQASite
		appcmd stop site TicketingSystemQASite
		ECHO TICKETINGSYSTEMDEVSITE STOPPED
		goto CopyNewFilesAfterServiceStop
		REM :StopProdSite
		REM appcmd stop site TicketingSystemDevSite
		REM goto CopyNewFilesAfterServiceStop
		
		:CopyNewFilesAfterServiceStop
		echo Extracting buildFiles.....
		set buildFilesPath="E:\FTP_ROOT\output"
		cd /D %buildFilesPath%
		for /F %%I IN ('dir /b /s *.zip *.rar') DO (
			"E:\FTP_ROOT\output\utility\7zip\7za.exe" x -o"%%~dpI" "%%I"
		)
		echo Deleting Existing build files...
		set currentBuildFilesPath="E:\WebSites\TicketingSystemDevSite"
		cd /D %currentBuildFilesPath%
		for /F %%i IN ('dir /b ' ) DO (
			IF EXIST %%i\NUL rd %%i /s /q
			if not %%i == web.config del %%i /s /f /q
		)
		echo Deleted current build files
		set psExecPath="E:\FTP_ROOT\output\utility\PowerShell"
		cd /D %psExecPath%
		PsExec64 \\10.202.
		REM echo Copying latest buildFiles...
		REM if '%appEnv%' == 'dev' goto CopyNewFilesToDevSite
		REM if '%appEnv%' == 'qa' goto CopyNewFilesToQASite
		REM if '%appEnv%' == 'prod' goto CopyNewFilesToProdSite
		
			REM :CopyNewFilesToDevSite
				REM XCOPY E:\E:\FTP_ROOT\output\buildFiles\ E:\WebSites\TicketingSystemDevSite\ /s /e
				REM cd /D %appcmdPath%
				
			REM :CopyNewFilesToQASite
				REM XCOPY E:\E:\FTP_ROOT\output\buildFiles\ E:\WebSites\TicketingSystemQASite\ /s /e
			REM :CopyNewFilesToProdSite
		
pause