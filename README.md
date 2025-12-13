<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1Ew_j779RPd1d3hA2UsmK8t8Fy_t_KSrH

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the app:
   ```bash
   npm run dev
   ```

3. Open your browser to `http://localhost:3000`

4. When prompted, enter your Gemini API key (get one from [Google AI Studio](https://aistudio.google.com/app/apikey))

## Security & Privacy

### API Key Management

**IMPORTANT:** This application requires a Google Gemini API key to function. The key is:

- ✅ **Stored locally** in your browser's localStorage (never sent to our servers)
- ✅ **Never embedded** in the source code or build artifacts
- ✅ **User-controlled** - each user provides their own key
- ✅ **Removable** - can be cleared at any time via the key icon in the UI

### Configuration (Optional)

For development convenience, you can optionally create a `.env.local` file:

```bash
cp .env.local.example .env.local
# Edit .env.local and add your API key
```

⚠️ **NEVER commit `.env.local` or any file containing API keys to Git!**

### Best Practices

1. **Never share your API key** with others
2. **Never commit API keys** to version control
3. **Rotate keys regularly** if you suspect they've been compromised
4. **Use API key restrictions** in Google Cloud Console to limit usage
5. **Monitor your API usage** at [Google Cloud Console](https://console.cloud.google.com/)

### Data Privacy

- Video streams are **processed locally** for motion detection
- Frames are **only sent to Google Gemini** when analysis is needed
- **No data is stored** on any server - everything runs in your browser
- **No telemetry or tracking** - your privacy is respected

## Disclaimer

This application is a technical demonstration and is **NOT** a certified medical device. It should never replace direct parental supervision. Always rely on your own judgment for child safety.
