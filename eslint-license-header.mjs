import { readFileSync } from 'node:fs';

// The header text lives once in the root `license_header` file, shared with the gradle
// LicensePlugin (see build-support). npm modules cannot use that JVM plugin, so this helper
// renders the same text as a JS block comment for eslint-plugin-notice, keeping a single
// source of truth for the copyright header across JVM and npm modules.
const LICENSE_HEADER_FILE_URL = new URL('./license_header', import.meta.url);

function readSharedLicenseHeaderText() {
	// Checkouts differ in line endings (core.autocrlf), so normalize CRLF to LF to render
	// an identical template on every platform.
	return readFileSync(LICENSE_HEADER_FILE_URL, 'utf8').replace(/\r\n/g, '\n').replace(/\n+$/, '');
}

function renderTextAsJsBlockComment(headerText) {
	const commentBody = headerText
		.split('\n')
		.map(function prefixLineWithCommentAsterisk(line) {
			return line.length > 0 ? ` * ${line}` : ' *';
		})
		.join('\n');
	return `/*\n${commentBody}\n */\n\n`;
}

// Ready to use as the `template` option of eslint-plugin-notice. Mirrors the gradle
// LicensePlugin BLOCK_COMMENT style so both toolchains produce identical headers.
export function readSharedLicenseHeaderAsJsBlockComment() {
	return renderTextAsJsBlockComment(readSharedLicenseHeaderText());
}

// Ready to use as the options object of the `notice/notice` rule. Every npm module enforces
// the header the same way, so the settings live here rather than in each eslint config.
export function createSharedLicenseHeaderNoticeOptions() {
	const template = readSharedLicenseHeaderAsJsBlockComment();
	return {
		template,
		// The gradle LicensePlugin strips an outdated header before applying the new one.
		// 'prepend' would instead stack a second header on top of the outdated one.
		onNonMatchingHeader: 'replace',
		// How many characters at the top of a file the rule scans for the header. The header
		// starts at the first character, so its own length is enough — plus one per line,
		// because the rule slices the raw text before normalising CRLF to LF and a Windows
		// checkout spends an extra character on every line break.
		chars: template.length + template.split('\n').length,
	};
}
