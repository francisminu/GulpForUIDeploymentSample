
# Get the ID and security principal of the current user account
$myWindowsID = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$myWindowsPrincipal = new-object System.Security.Principal.WindowsPrincipal($myWindowsID)
 
# Get the security principal for the Administrator role
$adminRole = [System.Security.Principal.WindowsBuiltInRole]::Administrator
 
# Check to see if we are currently running "as Administrator"
if ($myWindowsPrincipal.IsInRole($adminRole)) {
    # We are running "as Administrator" - so change the title and background color to indicate this
    $Host.UI.RawUI.WindowTitle = $myInvocation.MyCommand.Definition + "(Elevated)"
    $Host.UI.RawUI.BackgroundColor = "DarkBlue"
    clear-host
}
else {
    # We are not running "as Administrator" - so relaunch as administrator
   
    # Create a new process object that starts PowerShell
    $newProcess = new-object System.Diagnostics.ProcessStartInfo "PowerShell";
   
    # Specify the current script path and name as a parameter
    $newProcess.Arguments = $myInvocation.MyCommand.Definition;
   
    # Indicate that the process should be elevated
    $newProcess.Verb = "runas";
   
    # Start the new process
    [System.Diagnostics.Process]::Start($newProcess);
   
    # Exit from the current, unelevated, process
    exit
}

$config = new-object psobject
$scriptpath = $MyInvocation.MyCommand.Path
$dir = Split-Path $scriptpath

function Get-DevServers {
	Set-Location $dir
    $jsonFile = "./appconfig.json"
    $content = Get-Content $jsonFile -Raw
    $JsonParameters = ConvertFrom-Json -InputObject $content
	Add-Member -InputObject $config -MemberType NoteProperty -Name siteName -Value $JsonParameters.dev.siteName
    return $JsonParameters.dev.servers
}

function Get-QAServers {
	Set-Location $dir
    $jsonFile = "./appconfig.json"
    $content = Get-Content $jsonFile -Raw
    $JsonParameters = ConvertFrom-Json -InputObject $content
	Add-Member -InputObject $config -MemberType NoteProperty -Name siteName -Value $JsonParameters.qa.siteName
    return $JsonParameters.qa.servers
}

function Get-ProdServers {
	Set-Location $dir
    $jsonFile = "./appconfig.json"
    $content = Get-Content $jsonFile -Raw
    $JsonParameters = ConvertFrom-Json -InputObject $content
	Add-Member -InputObject $config -MemberType NoteProperty -Name siteName -Value $JsonParameters.prod.siteName
    return $JsonParameters.prod.servers
}

function Create-MultiSelect-ListBox($serverList) {
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing

    $form = New-Object System.Windows.Forms.Form
    $form.Text = 'SERVERS'
    $form.Size = New-Object System.Drawing.Size(300, 200)
    $form.StartPosition = 'CenterScreen'

    $OKButton = New-Object System.Windows.Forms.Button
    $OKButton.Location = New-Object System.Drawing.Point(75, 120)
    $OKButton.Size = New-Object System.Drawing.Size(75, 23)
    $OKButton.Text = 'OK'
    $OKButton.DialogResult = [System.Windows.Forms.DialogResult]::OK
    $form.AcceptButton = $OKButton
    $form.Controls.Add($OKButton)

    $CancelButton = New-Object System.Windows.Forms.Button
    $CancelButton.Location = New-Object System.Drawing.Point(150, 120)
    $CancelButton.Size = New-Object System.Drawing.Size(75, 23)
    $CancelButton.Text = 'Cancel'
    $CancelButton.DialogResult = [System.Windows.Forms.DialogResult]::Cancel
    $form.CancelButton = $CancelButton
    $form.Controls.Add($CancelButton)

    $label = New-Object System.Windows.Forms.Label
    $label.Location = New-Object System.Drawing.Point(10, 20)
    $label.Size = New-Object System.Drawing.Size(280, 20)
    $label.Text = 'Select the servers for deployment: '
    $form.Controls.Add($label)

    $listBox = New-Object System.Windows.Forms.Listbox
    $listBox.Location = New-Object System.Drawing.Point(10, 40)
    $listBox.Size = New-Object System.Drawing.Size(260, 20)

    $listBox.SelectionMode = 'MultiExtended'

    For ($i = 0; $i -lt $serverList.Length; $i++) {
        # Write-Host "Server is " $JsonParameters.qa_servers[$i]
        [void] $listBox.Items.Add($serverList[$i].serverName + "(" + $serverList[$i].ipAddress + ")")
    }

    $listBox.Height = 70
    $form.Controls.Add($listBox)
    $form.Topmost = $true

    $result = $form.ShowDialog()

    if ($result -eq [System.Windows.Forms.DialogResult]::OK) {
        $x = $listBox.SelectedItems
        return $x
    }
}

function Get-DeploymentEnvironment {
    $env = Read-Host -Prompt 'Choose the development environment (dev/qa/prod): '
    Add-Member -InputObject $config -MemberType NoteProperty -Name deployEnv -Value $env
}

function StartDeployment {
    Get-DeploymentEnvironment
    Write-Host "Deployment Environment chosen is: " $config.deployEnv -ForegroundColor Green
    
    switch ($config.deployEnv) {
        "dev" { 
            $serverList = Get-DevServers 
            $selectedServers = Create-MultiSelect-ListBox $serverList
        }
        "qa" {
            $serverList = Get-QAServers 
            $selectedServers = Create-MultiSelect-ListBox $serverList
        }
        "prod" {
            $serverList = Get-ProdServers 
            $selectedServers = Create-MultiSelect-ListBox $serverList
        }
    }
    if ($selectedServers.length -eq 0) {
        Write-Host "Servers are not selected. Exiting deployment." -ForegroundColor Red
    }
    else {
        Add-Member -InputObject $config -MemberType NoteProperty -Name serverList -Value $selectedServers
        Write-Host "Selected servers are: " $config.serverList -ForegroundColor Green
    }
}
function Create-BackUp ($ipAddress, $siteName) {
    Write-Host "Creating backup..."
    $folderName = $(Get-Date -UFormat "%m%d%Y%H%M%S")
	Copy-Item "\\$ipAddress\e$\WebSites\$siteName" -Destination "\\$ipAddress\e$\WebSites\_backup\$siteName\$folderName" -Recurse
    Write-Host "Completed creating backup."
}

function Unzip-Build-Files($ipAddress, $siteName) {
	set-alias zip "\\$ipAddress\e$\FTP_ROOT\deployment\utility\7zip\7za.exe"
    Write-Host "Unzipping build files..." -ForegroundColor Green
	$zipfilePath = "\\$ipAddress\e$\FTP_ROOT\deployment\output\buildFiles.zip" 
	$destinationPath = "\\$ipAddress\e$\FTP_ROOT\deployment\output\buildFiles" 
    Set-Location \\$ipAddress\e$\FTP_ROOT\deployment\output
    zip x $zipfilePath -r -o"$destinationPath"
	Write-Host "Checking " $? -ForegroundColor Yellow
	if( $? -eq "True") {
		Write-Host "Unzipping completed successfully." -ForegroundColor Green
	} else {
		Write-Error "Error. unzip Failed. Deployment exited." -ForegroundColor Red
	}
}

function Delete-Current-Files($ipAddress, $siteName) {
	Write-Host "Deleting current files" -ForegroundColor Green
	Set-Location \\$ipAddress\e$\FTP_ROOT\deployment\output
	Remove-Item \\$ipAddress\e$\WebSites\$siteName -Include * -Exclude *.config -Recurse -Force
	Write-Host "Deleted current files" -ForegroundColor Green
}

function Copy-New-Files ($ipAddress, $siteName) {
    Write-Host "Copying new files....." -ForegroundColor Green
	Copy-Item "\\$ipAddress\e$\FTP_ROOT\deployment\output\buildFiles\*" -Destination "\\$ipAddress\e$\WebSites\$siteName\" -Recurse
    Write-Host "Copying new files complete." -ForegroundColor Green
}

function Stop-IIS-Site($ipAddress, $siteName) {
	Set-Location "$dir\utility\PowerShell"
	Write-Host "Stopping site $siteName...." -ForegroundColor Green
	$output = cmd /s /c "psexec64.exe \\$ipAddress C:\windows\system32\inetsrv\appcmd stop site $siteName"
	Write-Host "Checking " $? -ForegroundColor Yellow
    Write-Host "Stopped site $siteName successfully." -ForegroundColor Green
}

function Start-IIS-Site($ipAddress, $siteName) {
	try{
		Set-Location "$dir\utility\PowerShell" -ErrorAction Stop
		Write-Host "Starting site $siteName...." -ForegroundColor Green
		$output = cmd /s /c "psexec64.exe \\$ipAddress C:\windows\system32\inetsrv\appcmd start site $siteName" 
		if(!$?) {
			throw "Start-IIS-Site failed. PSExec failed."
		}
		Write-Host "Started site $siteName successfully." -ForegroundColor Green
	} catch {
		Write-Error "Start-IIS-Site failed. Deployment stopped."
		Write-Host "Press any key to exit deployment." -ForegroundColor Red
		$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
		Exit
	}	
}

function Deploy-Each-Server {
    if ($config.serverList.Count -eq 1) {
        # Start deployment on the single server
        Write-Host "Deployment started on Server: " $config.serverList -ForegroundColor Green
        $ipAddress = ($config.serverList.Split("{(}")[1]).Split("{)}")[0]
        $siteName = $config.siteName
		Stop-IIS-Site $ipAddress $siteName
        Create-BackUp $ipAddress $siteName
        Unzip-Build-Files $ipAddress $siteName
		Delete-Current-Files $ipAddress $siteName
		Copy-New-Files $ipAddress $siteName
		Start-IIS-Site $ipAddress $siteName
		Write-Host "Deployment complete on the server " $config.serverList -ForegroundColor Green
    } else {
        For ($i = 0; $i -lt $config.serverList.Count; $i++) {
            Write-Host "Deployment started on Server: " $config.serverList[$i]
            $ipAddress = ($config.serverList[$i].Split("{(}")[1]).Split("{)}")[0]
			$siteName = $config.siteName
			Stop-IIS-Site $ipAddress $siteName
			Create-BackUp $ipAddress $siteName
			Unzip-Build-Files $ipAddress $siteName
			Delete-Current-Files $ipAddress $siteName
			Copy-New-Files $ipAddress $siteName
			Start-IIS-Site $ipAddress $siteName
            Write-Host "Deployment complete on the server " $config.serverList[$i] -ForegroundColor Green
        }
    }
}

StartDeployment
Deploy-Each-Server
Write-Host -NoNewLine "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

