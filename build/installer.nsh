!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "nsDialogs.nsh"

!ifndef BUILD_UNINSTALLER
  Var MinoAutoStartCheckbox
  Var MinoAutoStart

  !macro customPageAfterChangeDir
    Page custom MinoAutoStartPage MinoAutoStartPageLeave
  !macroend

  Function MinoAutoStartPage
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}

    ${NSD_CreateCheckbox} 0 0 100% 12u "Start Dynamic Island when I sign in"
    Pop $MinoAutoStartCheckbox
    ReadRegStr $1 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Dynamic Island"
    ${If} $1 != ""
      ${NSD_Check} $MinoAutoStartCheckbox
      StrCpy $MinoAutoStart "1"
    ${Else}
      StrCpy $MinoAutoStart "0"
    ${EndIf}
    nsDialogs::Show
  FunctionEnd

  Function MinoAutoStartPageLeave
    ${NSD_GetState} $MinoAutoStartCheckbox $0
    StrCpy $MinoAutoStart "0"
    ${If} $0 == ${BST_CHECKED}
      StrCpy $MinoAutoStart "1"
    ${EndIf}
  FunctionEnd

  !macro customInstall
    ${If} $MinoAutoStart == "1"
      WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Dynamic Island" "$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\""
    ${Else}
      DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Dynamic Island"
    ${EndIf}
  !macroend
!endif

!ifdef BUILD_UNINSTALLER
  !macro customUnInstall
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "Dynamic Island"
  !macroend
!endif
