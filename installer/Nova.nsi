; Nova installer — tiny NSIS wrapper around Nova.exe (the Rust launcher).
;
; Installs to %LOCALAPPDATA%\Programs\Nova so we don't need admin rights.
; Nova.exe downloads Firefox on first run if it isn't already present on the
; system.

!define APP_NAME "Nova"
!define APP_VERSION "0.1.0"
!define APP_PUBLISHER "Nova"
!define APP_EXE "Nova.exe"
!define OUTFILE "..\dist\Nova-Setup-${APP_VERSION}.exe"

Unicode true
SetCompressor /SOLID lzma

Name "${APP_NAME} ${APP_VERSION}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\Nova"
RequestExecutionLevel user
ShowInstDetails show
ShowUninstDetails show
BrandingText "Nova — powered by Firefox"

; ---------- UI ----------
!include "MUI2.nsh"
!define MUI_ABORTWARNING
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

; ---------- install ----------
Section "Nova" SecNova
  SectionIn RO
  SetOutPath "$INSTDIR"
  File "..\dist\Nova.exe"

  ; Start menu shortcut
  CreateDirectory "$SMPROGRAMS\Nova"
  CreateShortCut "$SMPROGRAMS\Nova\Nova.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  ; Desktop shortcut
  CreateShortCut "$DESKTOP\Nova.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  ; Uninstaller
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  ; Registry entry so it shows up in "Add / Remove Programs" (per-user).
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nova" \
    "DisplayName" "Nova"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nova" \
    "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nova" \
    "Publisher" "${APP_PUBLISHER}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nova" \
    "DisplayIcon" "$INSTDIR\${APP_EXE}"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nova" \
    "UninstallString" "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nova" \
    "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nova" \
    "NoModify" 1
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nova" \
    "NoRepair" 1
SectionEnd

; ---------- uninstall ----------
Section "Uninstall"
  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir  "$INSTDIR"

  Delete "$SMPROGRAMS\Nova\Nova.lnk"
  RMDir  "$SMPROGRAMS\Nova"
  Delete "$DESKTOP\Nova.lnk"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nova"
SectionEnd
