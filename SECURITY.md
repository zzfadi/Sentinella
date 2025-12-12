# Security Policy

## Supported Versions

This project is currently in active development. Security updates will be applied to the latest version.

| Version | Supported          |
| ------- | ------------------ |
| Latest  | :white_check_mark: |

## Security Best Practices

### API Key Management

1. **Never commit API keys** to version control
2. **Use environment variables** or the in-app configuration UI
3. **Rotate keys regularly** if you suspect compromise
4. **Use API restrictions** in Google Cloud Console to limit key usage
5. **Monitor usage** at [Google Cloud Console](https://console.cloud.google.com/)

### Data Privacy

- Video streams are processed locally for motion detection
- Frames are only sent to Google Gemini API when analysis is needed
- No data is stored on external servers
- All processing happens client-side in your browser
- API keys are stored in browser localStorage (never transmitted to our servers)

### Input Validation

The application implements the following security measures:

- API key format validation (length and character restrictions)
- Input sanitization for all user-provided data
- Protection against XSS attacks
- Secure handling of external links (rel="noreferrer noopener")
- HTTPS requirement for camera access

## Reporting a Vulnerability

If you discover a security vulnerability in this project, please report it responsibly:

1. **Do NOT** open a public issue
2. Email the maintainer directly with details
3. Include steps to reproduce the vulnerability
4. Allow reasonable time for a fix before public disclosure

### What to Report

- Security vulnerabilities in dependencies
- Authentication/authorization bypasses
- Potential data leaks
- XSS or injection vulnerabilities
- Any other security concerns

## Known Limitations

1. **Not a Medical Device**: This application is a demonstration and should never replace direct supervision
2. **API Key Storage**: Keys are stored in browser localStorage (client-side only)
3. **Network Security**: Communication with Google Gemini API requires HTTPS
4. **Browser Security**: Relies on browser security features for isolation

## Security Measures Implemented

- ✅ Input validation on all user inputs
- ✅ API key format validation
- ✅ XSS prevention through React's built-in escaping
- ✅ Secure external link handling (rel="noreferrer noopener")
- ✅ .gitignore configured to prevent accidental key commits
- ✅ No server-side storage of sensitive data
- ✅ Client-side only architecture (no backend vulnerabilities)
- ✅ Dependency vulnerability scanning via GitHub Dependabot

## Secure Development

When contributing to this project:

1. Never commit secrets or API keys
2. Use `.env.local.example` as a template
3. Run security scans before submitting PRs
4. Follow secure coding practices
5. Keep dependencies up to date

## License

This security policy is part of the Sentinella project and follows the same license terms.
