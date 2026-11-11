The app uses the Vosk English-Indian model `vosk-model-small-en-in-0.4`.
Create `runtime\vosk-model-small-en-in-0.4.tar.gz` from the extracted model
directory, keeping the model directory at the archive root. The runtime folder
contains only the archive copied to the renderer output for offline use.

```powershell
tar.exe -czf assets/models/runtime/vosk-model-small-en-in-0.4.tar.gz -C assets/models vosk-model-small-en-in-0.4
```
