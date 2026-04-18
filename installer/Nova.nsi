; Nova installer — minimal NSIS wrapper around Nova.exe.
;
; Installs to %LOCALAPPDATA%\Programs\Nova so we don't need admin rights
; (which also reduces SmartScreen / UAC friction). Supports Arabic + English.

!define APP_NAME "Nova"
!define APP_VERSION "0.1.0"
!define APP_PUBLISHER "Nova"
!define APP_EXE "Nova.exe"
!define OUTFILE "dist\Nova-Setup-${APP_VERSION}.exe"

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
!define MUI_ICON "..\launcher\assets\nova.ico"
!define MUI_UNICON "..\launcher\assets\nova.ico"
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Launch Nova"

!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "English"
!insertmacro MUI_LANGUAGE "Arabic"

; ---------- install ----------
Section "Nova" SecNova
  SectionIn RO
  SetOutPath "$INSTDIR"
  File "dist\Nova.exe"
  File "..\launcher\assets\nova.ico"

  ; Start menu shortcut
  CreateDirectory "$SMPROGRAMS\Nova"
  CreateShortCut "$SMPROGRAMS\Nova\Nova.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\nova.ico" 0

  ; Desktop shortcut
  CreateShortCut "$DESKTOP\Nova.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\nova.ico" 0

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
    "DisplayIcon" "$INSTDIR\nova.ico"
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
  Delete "$INSTDIR\nova.ico"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir  "$INSTDIR"

  Delete "$SMPROGRAMS\Nova\Nova.lnk"
  RMDir  "$SMPROGRAMS\Nova"
  Delete "$DESKTOP\Nova.lnk"

  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\Nova"
SectionEnd
