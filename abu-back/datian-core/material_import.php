<?php

if (!function_exists('material_import_normalize_files')) {
    function material_import_normalize_files($filesKey)
    {
        if (!isset($_FILES[$filesKey])) {
            return [];
        }
        $raw = $_FILES[$filesKey];
        if (!is_array($raw) || !isset($raw['name'])) {
            return [];
        }

        $names = is_array($raw['name']) ? $raw['name'] : [$raw['name']];
        $tmpNames = is_array($raw['tmp_name'] ?? null) ? $raw['tmp_name'] : [$raw['tmp_name'] ?? ''];
        $errors = is_array($raw['error'] ?? null) ? $raw['error'] : [$raw['error'] ?? UPLOAD_ERR_NO_FILE];
        $sizes = is_array($raw['size'] ?? null) ? $raw['size'] : [$raw['size'] ?? 0];
        $types = is_array($raw['type'] ?? null) ? $raw['type'] : [$raw['type'] ?? ''];

        $files = [];
        $count = count($names);
        for ($i = 0; $i < $count; $i++) {
            $files[] = [
                'name' => (string)($names[$i] ?? ''),
                'tmp_name' => (string)($tmpNames[$i] ?? ''),
                'error' => (int)($errors[$i] ?? UPLOAD_ERR_NO_FILE),
                'size' => (int)($sizes[$i] ?? 0),
                'type' => (string)($types[$i] ?? ''),
            ];
        }
        return $files;
    }
}

if (!function_exists('material_import_sanitize_filename')) {
    function material_import_sanitize_filename($name)
    {
        $base = trim((string)$name);
        if ($base === '') {
            return 'material';
        }
        $base = preg_replace('/[^\p{L}\p{N}._-]+/u', '_', $base);
        $base = trim((string)$base, '._-');
        return $base !== '' ? $base : 'material';
    }
}

if (!function_exists('material_import_clean_text')) {
    function material_import_clean_text($text)
    {
        $text = (string)$text;
        $text = str_replace("\r\n", "\n", $text);
        $text = str_replace("\r", "\n", $text);
        $text = preg_replace("/[ \t]+/", " ", $text);
        $text = preg_replace("/\n{3,}/", "\n\n", $text);
        return trim((string)$text);
    }
}

if (!function_exists('material_import_extract_docx')) {
    function material_import_extract_docx($path)
    {
        $path = (string)$path;
        if ($path === '' || !is_readable($path)) {
            return ['text' => '', 'warning' => 'DOCX-Datei nicht lesbar.'];
        }

        if (!class_exists('ZipArchive')) {
            return ['text' => '', 'warning' => 'ZipArchive fehlt (DOCX kann nicht gelesen werden).'];
        }

        $zip = new ZipArchive();
        $open = $zip->open($path);
        if ($open !== true) {
            return ['text' => '', 'warning' => 'DOCX konnte nicht geöffnet werden.'];
        }

        $xml = $zip->getFromName('word/document.xml');
        $zip->close();
        if (!is_string($xml) || $xml === '') {
            return ['text' => '', 'warning' => 'DOCX enthält kein word/document.xml.'];
        }

        $dom = new DOMDocument();
        $loaded = @$dom->loadXML($xml);
        if (!$loaded) {
            // fallback: strip tags from raw xml
            $text = material_import_clean_text(strip_tags($xml));
            return ['text' => $text, 'warning' => 'DOCX XML konnte nicht vollständig geparst werden (Fallback).'];
        }

        $xpath = new DOMXPath($dom);
        $xpath->registerNamespace('w', 'http://schemas.openxmlformats.org/wordprocessingml/2006/main');

        $paragraphs = $xpath->query('//w:p');
        if ($paragraphs === false) {
            $text = material_import_clean_text(strip_tags($dom->saveXML()));
            return ['text' => $text, 'warning' => 'DOCX XPath fehlgeschlagen (Fallback).'];
        }

        $lines = [];
        foreach ($paragraphs as $p) {
            $texts = $xpath->query('.//w:t', $p);
            if ($texts === false) {
                continue;
            }
            $buffer = '';
            foreach ($texts as $t) {
                $buffer .= (string)$t->nodeValue;
            }
            $buffer = trim((string)$buffer);
            if ($buffer !== '') {
                $lines[] = $buffer;
            }
        }

        $text = material_import_clean_text(implode("\n\n", $lines));
        return ['text' => $text, 'warning' => ''];
    }
}

if (!function_exists('material_import_extract_pdf')) {
    function material_import_extract_pdf($path)
    {
        $path = (string)$path;
        if ($path === '' || !is_readable($path)) {
            return ['text' => '', 'warning' => 'PDF-Datei nicht lesbar.'];
        }

        $bin = '';
        $envBin = getenv('PDFTOTEXT_BIN');
        if ($envBin !== false && trim((string)$envBin) !== '') {
            $candidate = trim((string)$envBin);
            // Only trust env override when it looks usable.
            if ($candidate !== '' && (is_file($candidate) || is_executable($candidate))) {
                $bin = $candidate;
            }
        }
        if ($bin === '') {
            $candidates = [
                '/usr/bin/pdftotext',
                '/usr/local/bin/pdftotext',
                '/opt/homebrew/bin/pdftotext',
            ];
            foreach ($candidates as $candidate) {
                if (is_string($candidate) && $candidate !== '' && (is_file($candidate) || is_executable($candidate))) {
                    $bin = $candidate;
                    break;
                }
            }
        }
        if ($bin === '' && function_exists('shell_exec')) {
            $which = trim((string)@shell_exec('which pdftotext 2>/dev/null'));
            if ($which !== '' && is_executable($which)) {
                $bin = $which;
            }
        }
        if ($bin === '') {
            return [
                'text' => '',
                'warning' =>
                    'pdftotext nicht installiert/auffindbar (PDF kann nicht extrahiert werden). ' .
                    'Installiere poppler-utils oder setze PDFTOTEXT_BIN.',
            ];
        }

        $cmd = escapeshellarg($bin) .
            ' -layout -enc UTF-8 ' .
            escapeshellarg($path) .
            ' - 2>/dev/null';
        $out = @shell_exec($cmd);
        $text = material_import_clean_text(is_string($out) ? $out : '');
        if ($text === '') {
            return ['text' => '', 'warning' => 'PDF konnte nicht extrahiert werden (leerer Text).'];
        }
        return ['text' => $text, 'warning' => ''];
    }
}

if (!function_exists('material_import_sanitize_sheet_html')) {
    function material_import_sanitize_sheet_html($html)
    {
        $html = (string)$html;
        if ($html === '') {
            return '';
        }

        // Defensive cleanup: imported LLM HTML is rendered via {@html} in the frontend.
        // Keep this lightweight and focused on obviously unsafe constructs.
        $html = preg_replace('/<script\\b[^>]*>.*?<\\/script\\s*>/is', '', $html);
        $html = preg_replace('/<style\\b[^>]*>.*?<\\/style\\s*>/is', '', $html);
        $html = preg_replace('/\\son\\w+\\s*=\\s*\"[^\"]*\"/i', '', $html);
        $html = preg_replace("/\\son\\w+\\s*=\\s*'[^']*'/i", '', $html);
        $html = preg_replace('/\\son\\w+\\s*=\\s*[^\\s>]+/i', '', $html);

        // Backward compatibility: normalize deprecated <luecke-gap-wide> to <luecke-gap width="100%">.
        $html = preg_replace('/<\\s*luecke-gap-wide\\b/i', '<luecke-gap width="100%"', $html);
        $html = preg_replace('/<\\/\\s*luecke-gap-wide\\s*>/i', '</luecke-gap>', $html);

        return trim((string)$html);
    }
}

?>
