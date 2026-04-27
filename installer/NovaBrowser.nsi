; NovaBrowser Installer — NSIS script for the WPF + CefSharp browser.
;
; Installs all published files to %LOCALAPPDATA%\Programs\NovaBrowser.
; Registers as a Windows browser so the user can set it as default.
; No admin rights required (per-user install).

!define APP_NAME "Nova Browser"
!define APP_VERSION "1.0.0"
!define APP_PUBLISHER "Nova"
!define APP_EXE "NovaBrowser.exe"
!define APP_REG_KEY "NovaBrowser"
!define OUTFILE "dist\NovaBrowser-Setup-${APP_VERSION}.exe"

Unicode true
SetCompressor /SOLID lzma

Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\NovaBrowser"
RequestExecutionLevel user
ShowInstDetails show
ShowUninstDetails show
BrandingText "Nova Browser — powered by Chromium"

; ---------- UI ----------
!include "MUI2.nsh"
!define MUI_ABORTWARNING
!define MUI_ICON "launcher\assets\nova.ico"
!define MUI_UNICON "launcher\assets\nova.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Nova Browser"

!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Arabic"

; ---------- install ----------
Section "Nova Browser" SecNovaBrowser
  SectionIn RO
  SetOutPath "$INSTDIR"

  ; Copy all published files (exe, dlls, resources, CefSharp binaries, etc.)
  File /r "dist\NovaBrowser\*.*"

  ; Copy icon
  File "launcher\assets\nova.ico"

  ; Start menu shortcuts
  CreateDirectory "$SMPROGRAMS\Nova Browser"
  CreateShortCut "$SMPROGRAMS\Nova Browser\Nova Browser.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\nova.ico" 0
  CreateShortCut "$SMPROGRAMS\Nova Browser\Uninstall Nova Browser.lnk" "$INSTDIR\Uninstall.exe" "" "$INSTDIR\nova.ico" 0

  ; Desktop shortcut
  CreateShortCut "$DESKTOP\Nova Browser.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\nova.ico" 0

  ; Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; --- Add/Remove Programs registry ---
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_REG_KEY}" \
    "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_REG_KEY}" \
    "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_REG_KEY}" \
    "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_REG_KEY}" \
    "DisplayIcon" "$INSTDIR\nova.ico"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_REG_KEY}" \
    "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_REG_KEY}" \
    "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_REG_KEY}" \
    "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_REG_KEY}" \
    "NoRepair" 1

  ; --- Register as a browser in Windows ---
  ; Register application capabilities
  WriteRegStr HKCU "Software\${APP_REG_KEY}\Capabilities" \
    "ApplicationName" "${APP_NAME}"
  WriteRegStr HKCU "Software\${APP_REG_KEY}\Capabilities" \
    "ApplicationDescription" "Nova Browser — modern, sleek Chromium-based browser"
  WriteRegStr HKCU "Software\${APP_REG_KEY}\Capabilities" \
    "ApplicationIcon" "$INSTDIR\nova.ico,0"

  ; URL associations
  WriteRegStr HKCU "Software\${APP_REG_KEY}\Capabilities\URLAssociations" \
    "http" "NovaBrowserHTM"
  WriteRegStr HKCU "Software\${APP_REG_KEY}\Capabilities\URLAssociations" \
    "https" "NovaBrowserHTM"

  ; File associations
  WriteRegStr HKCU "Software\${APP_REG_KEY}\Capabilities\FileAssociations" \
    ".htm" "NovaBrowserHTM"
  WriteRegStr HKCU "Software\${APP_REG_KEY}\Capabilities\FileAssociations" \
    ".html" "NovaBrowserHTM"

  ; Register the ProgID for NovaBrowserHTM
  WriteRegStr HKCU "Software\Classes\NovaBrowserHTM" "" "Nova Browser HTML Document"
  WriteRegStr HKCU "Software\Classes\NovaBrowserHTM\DefaultIcon" "" "$INSTDIR\nova.ico,0"
  WriteRegStr HKCU "Software\Classes\NovaBrowserHTM\shell\open\command" "" '"$INSTDIR\${APP_EXE}" "%1"'

  ; Register in RegisteredApplications so Windows shows it in default browser list
  WriteRegStr HKCU "Software\RegisteredApplications" "${APP_NAME}" \
    "Software\${APP_REG_KEY}\Capabilities"

SectionEnd

; ---------- uninstall ----------
Section "Uninstall"
  ; Remove all installed files
  RMDir /r "$INSTDIR"

  ; Remove shortcuts
  Delete "$SMPROGRAMS\Nova Browser\Nova Browser.lnk"
  Delete "$SMPROGRAMS\Nova Browser\Uninstall Nova Browser.lnk"
  RMDir  "$SMPROGRAMS\Nova Browser"
  Delete "$DESKTOP\Nova Browser.lnk"

  ; Remove Add/Remove Programs entry
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_REG_KEY}"

  ; Remove browser registration
  DeleteRegKey HKCU "Software\${APP_REG_KEY}"
  DeleteRegKey HKCU "Software\Classes\NovaBrowserHTM"
  DeleteRegValue HKCU "Software\RegisteredApplications" "${APP_NAME}"
SectionEnd
