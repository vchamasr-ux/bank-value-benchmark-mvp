# Strategic Intelligence Brief Generator

This directory contains the standalone Node.js script (`generate_tear_sheet.js`) responsible for generating the 6-page premium Strategic Intelligence Briefs in PDF format.

## Overview

The script pulls live data from the FDIC public API, calculates core KPIs, generates peer group benchmarks, and surfaces strategic "Market Mover" anomalies. It also integrates a Ridge Regression Scenario Engine to explicitly lay out the mathematical path to Top-Quartile Return on Assets (ROA), calculating the "Do No Harm" constraints and estimated Net Income dollar impacts.

## Requirements

1. **Node.js**: Ensure Node is installed on your system.
2. **Dependencies**: The script relies on the overarching project's `package.json`. Make sure you have run `npm install` in the root directory (specifically for `puppeteer`, `handlebars`, `google/generative-ai`, and `dotenv`).
3. **Puppeteer**: Uses a headless Chromium instance to perfectly render the HTML/CSS template into a strict paginated PDF.

## Usage

Navigate to this directory in your terminal and run the script, passing the FDIC CERT number of the target bank format:

```bash
cd "scripts/export_reports"
node generate_tear_sheet.js --cert=3510
```
*(Replace `3510` with your target bank's CERT number.)*

The generated PDF will be placed in the `scripts/export_reports/output/` directory as `[bank_name]_tear_sheet.pdf`.

---

## AI Narrative Generation & The Manual Fallback System

The script attempts to use the Gemini AI API (via the `GEMINI_API_KEY` in your root `.env.local` file) to synthesize a 3-paragraph Executive Narrative for Page 2 of the brief.

**If the API call fails or times out** (e.g., due to strict API quotas), the script implements a robust manual fallback workflow so you are never left without a completed brief.

### The Fallback Workflow:

1. **Failure Detection**: The script waits 5 seconds for Gemini. If it times out or fails auth, it catches the error and gracefully continues rendering the PDF, leaving an "Automated Generation Unavailable" placeholder on Page 2.
2. **Prompt Generation (`prompt_fallback.txt`)**: Upon failure, the script will automatically generate a highly detailed, context-rich prompt tailored to the specific bank. It includes their exact stats, peer averages, and the scenario engine outputs. This file is saved to:
   * `scripts/export_reports/output/prompt_fallback.txt`
3. **Manual LLM Input**: Open `prompt_fallback.txt`, copy all the text, and paste it into your preferred secure LLM web portal (e.g., Google Gemini Advanced, ChatGPT Plus, Claude).
4. **Injection (`ai_summary_input.txt`)**: Copy the polished 3-paragraph response the LLM gives you, and paste it into a *new* file named exactly:
   * `scripts/export_reports/output/ai_summary_input.txt`
5. **Re-Run**: Run the exact same node command again:
   * `node generate_tear_sheet.js --cert=3510`
   * The script will detect `ai_summary_input.txt`, bypass the API entirely, and seamlessly inject your manual text into the final 6-page PDF.

> **Pro Tip**: Delete or rename `ai_summary_input.txt` when you move on to a different bank, otherwise the script will reuse the old text!

## Files in this Directory

*   `generate_tear_sheet.js`: The main execution script.
*   `template.html`: The HTML/Handlebars template that defines the 6-page visual structure and style.
*   `output/`: The directory where the final PDFs, fallback prompts, and manual AI inputs are read from/written to.
