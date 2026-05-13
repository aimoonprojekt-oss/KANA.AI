#!/bin/bash
cd ~/Desktop/agent-platform

echo "Lösche temporäre und veraltete Dateien..."

# Altes Push-Script (ersetzt durch scripts/deploy.command)
rm -f kanaai_push.command && echo "  ✓ kanaai_push.command gelöscht" || echo "  – kanaai_push.command nicht gefunden"

# TypeScript Build-Cache (wird automatisch neu erstellt)
rm -f tsconfig.tsbuildinfo && echo "  ✓ tsconfig.tsbuildinfo gelöscht" || echo "  – tsconfig.tsbuildinfo nicht gefunden"

# macOS Junk-Dateien
find . -name ".DS_Store" -not -path "*/node_modules/*" -not -path "*/.git/*" -delete
echo "  ✓ .DS_Store Dateien gelöscht"

echo ""
echo "Fertig! Ordnerstruktur ist jetzt sauber."
echo ""
read -p "Fenster schliessen? [Enter]"
