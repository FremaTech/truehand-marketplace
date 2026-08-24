# Browser Tool

You have access to a headless multi-profile browser. Use the REST API:

## List profiles
GET /api/browser/profiles

## Open new session
POST /api/browser/sessions
Body: {"profileId": "anonimo" | "frede-personal" | "fremaTech" | "stoic-meridian" | "test"}
Returns: {ok, id, profileId, url}

## Navigate
POST /api/browser/<sid>/navigate
Body: {"url": "https://example.com"}

## Extract page text
GET /api/browser/<sid>/text?selector=optional_css_selector

## Take screenshot (returns PNG bytes)
GET /api/browser/<sid>/screenshot

## Click element
POST /api/browser/<sid>/click
Body: {"selector": "button.submit"} or {"x": 100, "y": 200}

## Type text
POST /api/browser/<sid>/type
Body: {"selector": "input#search", "text": "query"}

## Evaluate JS
POST /api/browser/<sid>/eval
Body: {"code": "() => document.title"}

## Close session
DELETE /api/browser/sessions?id=<sid>

## CLI shortcut
The bin/agentic-browser bash script provides shortcuts:
- agentic-browser open <profile>
- agentic-browser goto <sid> <url>
- agentic-browser text <sid>
- agentic-browser screenshot <sid> [out.png]
- agentic-browser close <sid>

## Profile isolation
Each profile has separate cookies/localStorage/sessions in ~/.agentic-os/browser-profiles/<id>/
Default profiles: anonimo, frede-personal, fremaTech, stoic-meridian, test.
