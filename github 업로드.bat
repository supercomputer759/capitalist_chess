@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

title GitHub 업데이트
cd /d "%~dp0"

echo ========================================
echo          GitHub 업데이트
echo ========================================
echo.

git --version >nul 2>&1
if errorlevel 1 (
    echo [오류] Git이 설치되어 있지 않거나 PATH에 없습니다.
    pause
    exit /b 1
)

if not exist ".git" (
    echo [초기 설정] Git 저장소가 아닙니다.
    echo Git 저장소를 생성합니다...
    echo.

    git init
    if errorlevel 1 goto ERROR

    git branch -M main

    echo.
    set /p REPO_URL="GitHub 저장소 URL 입력: "

    if "!REPO_URL!"=="" (
        echo [오류] 저장소 URL이 필요합니다.
        pause
        exit /b 1
    )

    git remote add origin "!REPO_URL!"
    if errorlevel 1 goto ERROR

    echo.
    echo [완료] GitHub 저장소 연결 완료!
    echo.
)

echo [1/4] 현재 상태
echo ----------------------------------------
git status
echo.

echo [2/4] 변경사항 추가
git add .
if errorlevel 1 goto ERROR

git diff --cached --quiet
if not errorlevel 1 (
    echo.
    echo 변경사항이 없습니다.
    echo GitHub와 동기화만 확인합니다...
    git push
    goto SUCCESS
)

echo.
echo [3/4] 커밋
git commit -m "업데이트"
if errorlevel 1 goto ERROR

echo.
echo [4/4] GitHub Push

git rev-parse --abbrev-ref --symbolic-full-name "@{u}" >nul 2>&1

if errorlevel 1 (
    git push -u origin main
) else (
    git push
)

if errorlevel 1 goto ERROR

:SUCCESS
echo.
echo ========================================
echo        업데이트 완료!
echo ========================================
pause
exit /b 0

:ERROR
echo.
echo ========================================
echo       업데이트 중 오류 발생
echo ========================================
pause
exit /b 1