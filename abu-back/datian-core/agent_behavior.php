<?php

if (!function_exists('agent_normalize_heading_key')) {
    function agent_normalize_heading_key($label)
    {
        $key = strtolower(trim((string)$label));
        $key = str_replace(['ä', 'ö', 'ü', 'ß'], ['ae', 'oe', 'ue', 'ss'], $key);
        $key = preg_replace('/[^a-z0-9]+/', '', $key);
        $map = [
            'rolle' => 'role',
            'role' => 'role',
            'ziel' => 'goal',
            'goal' => 'goal',
            'objective' => 'goal',
            'kontext' => 'context',
            'context' => 'context',
            'material' => 'material',
            'aufgabe' => 'tasks',
            'aufgaben' => 'tasks',
            'task' => 'tasks',
            'tasks' => 'tasks',
            'arbeitsregeln' => 'rules',
            'regeln' => 'rules',
            'rules' => 'rules',
            'ausgabeformat' => 'output_format',
            'outputformat' => 'output_format',
            'format' => 'output_format',
            'qualitaetskriterien' => 'quality',
            'qualitaet' => 'quality',
            'quality' => 'quality',
            'sprache' => 'language',
            'language' => 'language',
            'stil' => 'style',
            'style' => 'style',
            'modul' => 'modules',
            'module' => 'modules',
            'mods' => 'modules',
        ];
        return $map[$key] ?? '';
    }
}

if (!function_exists('agent_clean_list_item')) {
    function agent_clean_list_item($value)
    {
        $line = trim((string)$value);
        if ($line === '') {
            return '';
        }
        $line = preg_replace('/^\s*(?:[-*]+|\d+[.)])\s*/u', '', $line);
        return trim((string)$line);
    }
}

if (!function_exists('agent_to_lines')) {
    function agent_to_lines($value)
    {
        if (is_array($value)) {
            $result = [];
            foreach ($value as $entry) {
                $result = array_merge($result, agent_to_lines($entry));
            }
            return $result;
        }
        $text = trim((string)$value);
        if ($text === '') {
            return [];
        }
        $parts = preg_split('/\r\n|\r|\n/', $text) ?: [];
        $result = [];
        foreach ($parts as $part) {
            $line = agent_clean_list_item($part);
            if ($line !== '') {
                $result[] = $line;
            }
        }
        return $result;
    }
}

if (!function_exists('agent_parse_schema_from_prompt')) {
    function agent_parse_schema_from_prompt($prompt)
    {
        $sections = [
            'role' => [],
            'goal' => [],
            'context' => [],
            'material' => [],
            'tasks' => [],
            'rules' => [],
            'output_format' => [],
            'quality' => [],
            'language' => [],
            'style' => [],
            'modules' => [],
            'freeform' => [],
        ];
        $lines = preg_split('/\r\n|\r|\n/', (string)$prompt) ?: [];
        $current = 'freeform';
        foreach ($lines as $rawLine) {
            $line = trim((string)$rawLine);
            if ($line === '') {
                continue;
            }
            if (preg_match('/^\[\s*(?:modul|module)\s*:\s*(.+?)\s*\]$/iu', $line, $match)) {
                $sections['modules'][] = trim((string)$match[1]);
                $current = 'modules';
                continue;
            }
            if (preg_match('/^([A-Za-zÄÖÜäöüß _\/-]{2,40})\s*:\s*(.*)$/u', $line, $match)) {
                $key = agent_normalize_heading_key($match[1]);
                if ($key !== '') {
                    $current = $key;
                    $rest = agent_clean_list_item($match[2]);
                    if ($rest !== '') {
                        $sections[$current][] = $rest;
                    }
                    continue;
                }
            }
            $clean = agent_clean_list_item($line);
            if ($clean !== '') {
                $sections[$current][] = $clean;
            }
        }
        return $sections;
    }
}

if (!function_exists('agent_schema_lines')) {
    function agent_schema_lines($schema, $keys)
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $schema)) {
                $lines = agent_to_lines($schema[$key]);
                if (!empty($lines)) {
                    return $lines;
                }
            }
        }
        return [];
    }
}

if (!function_exists('agent_schema_text')) {
    function agent_schema_text($schema, $keys)
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $schema)) {
                if (is_array($schema[$key])) {
                    $lines = agent_to_lines($schema[$key]);
                    if (!empty($lines)) {
                        return (string)$lines[0];
                    }
                    continue;
                }
                $value = trim((string)$schema[$key]);
                if ($value !== '') {
                    return $value;
                }
            }
        }
        return '';
    }
}

if (!function_exists('agent_build_request_schema')) {
    function agent_build_request_schema($prompt, $promptSchema)
    {
        $parsed = agent_parse_schema_from_prompt($prompt);
        $schema = is_array($promptSchema) ? $promptSchema : [];

        $role = agent_schema_text($schema, ['role', 'rolle']);
        if ($role === '' && !empty($parsed['role'])) {
            $role = (string)$parsed['role'][0];
        }
        if ($role === '') {
            $role = 'Vielseitiger KI-Assistent fuer Analyse, Recherche, Sprache und HTML/CSS/JS.';
        }

        $goal = agent_schema_lines($schema, ['goal', 'ziel', 'objective']);
        if (empty($goal)) {
            $goal = $parsed['goal'];
        }
        if (empty($goal)) {
            $goal = ['Die Nutzeranfrage praezise und umsetzbar bearbeiten.'];
        }

        $context = agent_schema_lines($schema, ['context', 'kontext']);
        if (empty($context)) {
            $context = $parsed['context'];
        }

        $material = agent_schema_lines($schema, ['material']);
        if (empty($material)) {
            $material = $parsed['material'];
        }

        $tasks = agent_schema_lines($schema, ['tasks', 'task', 'aufgabe', 'aufgaben']);
        if (empty($tasks)) {
            $tasks = $parsed['tasks'];
        }
        if (empty($tasks) && !empty($parsed['freeform'])) {
            $tasks = [implode(' ', $parsed['freeform'])];
        }
        if (empty($tasks)) {
            $trimmedPrompt = trim((string)$prompt);
            if ($trimmedPrompt !== '') {
                $tasks = [$trimmedPrompt];
            }
        }

        $rules = agent_schema_lines($schema, ['rules', 'arbeitsregeln', 'regeln']);
        if (empty($rules)) {
            $rules = $parsed['rules'];
        }
        if (empty($rules)) {
            $rules = [
                'Wenn Informationen fehlen, zuerst kurze Annahmen und dann gezielte Rueckfrage.',
                'Bei Unsicherheit sinnvolle Alternativen mit Vor- und Nachteilen nennen.',
                'Bei Recherche nur belastbare Quellen verwenden, mit Datum und Links.',
                'Bei Code oder HTML lauffaehige Loesung liefern und keine stillen Platzhalter nutzen.',
                'Aenderungen klar kennzeichnen.',
            ];
        }

        $outputFormat = agent_schema_lines($schema, ['output_format', 'outputformat', 'ausgabeformat', 'format']);
        if (empty($outputFormat)) {
            $outputFormat = $parsed['output_format'];
        }
        if (empty($outputFormat)) {
            $outputFormat = [
                'Kurze Zusammenfassung (maximal 5 Saetze).',
                'Ergebnis (Analyse, Recherche oder Code).',
                'Naechste sinnvolle Schritte als nummerierte Liste.',
            ];
        }

        $quality = agent_schema_lines($schema, ['quality', 'qualitaetskriterien', 'qualitaet']);
        if (empty($quality)) {
            $quality = $parsed['quality'];
        }
        if (empty($quality)) {
            $quality = ['Korrektheit', 'Verstaendlichkeit', 'Technische Sauberkeit'];
        }

        $language = agent_schema_text($schema, ['language', 'sprache']);
        if ($language === '' && !empty($parsed['language'])) {
            $language = (string)$parsed['language'][0];
        }
        if ($language === '') {
            $language = 'Deutsch';
        }

        $style = agent_schema_text($schema, ['style', 'stil']);
        if ($style === '' && !empty($parsed['style'])) {
            $style = (string)$parsed['style'][0];
        }
        if ($style === '') {
            $style = 'Knapp und sachlich';
        }

        $modules = agent_schema_lines($schema, ['modules', 'module', 'modul']);
        if (empty($modules)) {
            $modules = $parsed['modules'];
        }

        return [
            'role' => $role,
            'goal' => $goal,
            'context' => $context,
            'material' => $material,
            'tasks' => $tasks,
            'rules' => $rules,
            'output_format' => $outputFormat,
            'quality' => $quality,
            'language' => $language,
            'style' => $style,
            'modules' => $modules,
            'original_prompt' => trim((string)$prompt),
        ];
    }
}

if (!function_exists('agent_render_prompt_schema')) {
    function agent_render_prompt_schema($schema, $runtimeContext, $notes = '')
    {
        $lines = [];
        $lines[] = 'Vormodul: Prompt-Schema (automatisch normalisiert)';
        $lines[] = 'Rolle: ' . (string)$schema['role'];
        $lines[] = '';
        $lines[] = 'Ziel:';
        foreach ($schema['goal'] as $line) {
            $lines[] = '- ' . $line;
        }
        $lines[] = '';
        $lines[] = 'Kontext:';
        foreach ($schema['context'] as $line) {
            $lines[] = '- ' . $line;
        }
        foreach ($runtimeContext as $line) {
            $lines[] = '- ' . $line;
        }
        $lines[] = '';
        $lines[] = 'Material:';
        foreach ($schema['material'] as $line) {
            $lines[] = '- ' . $line;
        }
        $lines[] = '';
        $lines[] = 'Aufgabe:';
        $taskIndex = 1;
        foreach ($schema['tasks'] as $line) {
            $lines[] = $taskIndex . '. ' . $line;
            $taskIndex++;
        }
        $lines[] = '';
        $lines[] = 'Arbeitsregeln:';
        foreach ($schema['rules'] as $line) {
            $lines[] = '- ' . $line;
        }
        $lines[] = '';
        $lines[] = 'Ausgabeformat:';
        foreach ($schema['output_format'] as $line) {
            $lines[] = '- ' . $line;
        }
        $lines[] = '';
        $lines[] = 'Qualitaetskriterien:';
        foreach ($schema['quality'] as $line) {
            $lines[] = '- ' . $line;
        }
        if (!empty($schema['modules'])) {
            $lines[] = '';
            $lines[] = 'Zusatzmodule:';
            foreach ($schema['modules'] as $line) {
                $lines[] = '- ' . $line;
            }
        }
        $lines[] = '';
        $lines[] = 'Sprache: ' . (string)$schema['language'];
        $lines[] = 'Stil: ' . (string)$schema['style'];
        if ($notes !== '') {
            $lines[] = '';
            $lines[] = "KI-Notizen:\n" . $notes;
        }
        if ((string)$schema['original_prompt'] !== '') {
            $lines[] = '';
            $lines[] = "Originale Anfrage:\n" . (string)$schema['original_prompt'];
        }
        return implode("\n", $lines);
    }
}

if (!function_exists('agent_prompt_prefers_document_scope')) {
    function agent_prompt_prefers_document_scope($prompt, $tasks = [])
    {
        $parts = [];
        $basePrompt = trim((string)$prompt);
        if ($basePrompt !== '') {
            $parts[] = $basePrompt;
        }
        if (is_array($tasks)) {
            foreach ($tasks as $task) {
                $line = trim((string)$task);
                if ($line !== '') {
                    $parts[] = $line;
                }
            }
        }
        if (empty($parts)) {
            return false;
        }

        $text = strtolower(implode(' ', $parts));
        $text = str_replace(['ä', 'ö', 'ü', 'ß'], ['ae', 'oe', 'ue', 'ss'], $text);

        $analysisTokens = [
            'bewerte',
            'bewertung',
            'beurteile',
            'geeignet',
            'eignung',
            'feedback',
            'analys',
            'pruef',
            'ist es geeignet',
            'passt das',
            'qualitaet',
        ];
        $documentTokens = [
            'uebung',
            'aufgabe',
            'arbeitsblatt',
            'sheet',
            'text',
            'inhalt',
            'abu',
        ];
        $editTokens = [
            'fuege',
            'insert',
            'erstelle',
            'generiere',
            'ersetze',
            'aendere',
            'formatiere',
            'schreibe',
            'setze',
        ];

        $hasAnalysis = false;
        foreach ($analysisTokens as $token) {
            if (strpos($text, $token) !== false) {
                $hasAnalysis = true;
                break;
            }
        }
        if (!$hasAnalysis) {
            return false;
        }

        $hasDocumentToken = false;
        foreach ($documentTokens as $token) {
            if (strpos($text, $token) !== false) {
                $hasDocumentToken = true;
                break;
            }
        }

        $hasEditToken = false;
        foreach ($editTokens as $token) {
            if (strpos($text, $token) !== false) {
                $hasEditToken = true;
                break;
            }
        }

        return $hasDocumentToken || !$hasEditToken;
    }
}

if (!function_exists('agent_get_system_message')) {
    function agent_get_system_message()
    {
        return 'Du bist ein Assistent fuer Lehrpersonen und bearbeitest Arbeitsblaetter im HTML-Format. ' .
            'Die Nutzeranfrage wurde bereits durch ein Vormodul in ein Prompt-Schema normalisiert. ' .
            'Du erhaeltst eine Benutzeranfrage und einen Kontext-Scope (block oder document). ' .
            'Antworte AUSSCHLIESSLICH als JSON mit diesen Feldern: ' .
            '"action" (replace_html | insert_html | message), ' .
            '"html" (string, leer falls keine Aenderung), ' .
            '"message" (deutsche Kurzantwort mit bis zu 8 Saetzen; Zeilenumbrueche sind erlaubt), ' .
            '"block_level" (true/false, ob html ein eigener Block ist), ' .
            '"view" (html | visual, welche Editor-Ansicht sich fuer das Snippet eignet). ' .
            'Nutze replace_html nur wenn wirklich noetig. Nutze sonst insert_html mit einem kleinen, gezielten Snippet. ' .
            'Nutze message, wenn die Anfrage nur Analyse oder Fehlersuche erfordert und keine Aenderung. ' .
            'Wenn fuer eine Analyse Informationen fehlen, liefere zuerst eine vorlaeufige Einschaetzung aus dem vorhandenen Kontext und stelle danach maximal 3 gezielte Rueckfragen. ' .
            'Bei Anfragen zur ABU-Eignung oder Aufgabenqualitaet nenne konkrete Kriterien statt nur nach dem Volltext zu fragen. ' .
            'Gib bei insert_html nur das Snippet zur Einfuegung zurueck, kein komplettes Dokument. ' .
            'Bei scope=block darf replace_html nur den aktualisierten Block liefern, nicht das gesamte Dokument. ' .
            'Bei scope=document darf replace_html den aktualisierten Gesamtinhalt liefern. ' .
            'Behalte bestehende Spezial-Tags (z.B. luecke-gap) bei und veraendere sie nur, wenn die Anfrage es erfordert. ' .
            'Kein Markdown, kein Code-Fence, nur JSON.';
    }
}

if (!function_exists('agent_build_runtime_context')) {
    function agent_build_runtime_context($context, $requestSchema)
    {
        $context = is_array($context) ? $context : [];
        $html = (string)($context['html'] ?? '');
        $view = (string)($context['view'] ?? '');
        $scope = (string)($context['scope'] ?? '');
        $activeBlockIndex = $context['activeBlockIndex'] ?? null;
        $activeBlockHtml = (string)($context['activeBlockHtml'] ?? '');
        $activeBlockView = (string)($context['activeBlockView'] ?? '');
        $blockCount = $context['blockCount'] ?? null;
        $documentLength = $context['documentLength'] ?? null;
        $visualTarget = (string)($context['visualTarget'] ?? '');

        if ($scope !== 'block' && $scope !== 'document') {
            $scope = $view === 'visual' ? 'block' : 'document';
        }

        $runtimeContextLines = [
            'Ansicht: ' . ($view !== '' ? $view : 'unbekannt'),
            'Scope: ' . $scope,
        ];
        if ($visualTarget !== '') {
            $runtimeContextLines[] = 'Einfuegen: ' . $visualTarget;
        }
        if ($activeBlockIndex !== null && $activeBlockIndex !== '') {
            $runtimeContextLines[] = 'Aktiver Block Index: ' . $activeBlockIndex;
        }
        if ($activeBlockView !== '') {
            $runtimeContextLines[] = 'Aktiver Block View: ' . $activeBlockView;
        }
        if ($blockCount !== null && $blockCount !== '') {
            $runtimeContextLines[] = 'Block-Anzahl: ' . $blockCount;
        }
        if ($documentLength !== null && $documentLength !== '') {
            $runtimeContextLines[] = 'Dokument-Laenge: ' . $documentLength;
        }

        $effectiveHtml = $html;
        $preferDocumentScope = $scope === 'block' &&
            agent_prompt_prefers_document_scope($requestSchema['original_prompt'] ?? '', $requestSchema['tasks'] ?? []);
        if ($scope === 'block' && !$preferDocumentScope && $activeBlockHtml !== '') {
            $effectiveHtml = $activeBlockHtml;
        }

        if ($scope === 'block' && !$preferDocumentScope) {
            $runtimeContextLines[] = "Aktiver Block HTML:\n" . $effectiveHtml;
        } else {
            if ($scope === 'block' && $preferDocumentScope) {
                $runtimeContextLines[] = 'Scope-Hinweis: Anfrage deutet auf Analyse des gesamten Dokuments.';
            }
            $runtimeContextLines[] = "Aktueller HTML-Inhalt:\n" . $effectiveHtml;
            if ($scope === 'block' && $activeBlockHtml !== '') {
                $runtimeContextLines[] = "Aktiver Block HTML (zusaetzlich):\n" . $activeBlockHtml;
            }
        }

        return [
            'scope' => $scope,
            'view' => $view,
            'runtime_context_lines' => $runtimeContextLines,
        ];
    }
}

if (!function_exists('agent_load_notes')) {
    function agent_load_notes($notesPath)
    {
        if ($notesPath === '' || !is_readable($notesPath)) {
            return '';
        }
        return trim((string)file_get_contents($notesPath));
    }
}

if (!function_exists('agent_build_model_messages')) {
    function agent_build_model_messages($prompt, $promptSchema, $context, $notesPath)
    {
        $requestSchema = agent_build_request_schema($prompt, $promptSchema);
        if (empty($requestSchema['tasks'])) {
            return [
                'status' => 400,
                'error' => 'prompt fehlt',
            ];
        }

        $runtime = agent_build_runtime_context($context, $requestSchema);
        $notes = agent_load_notes($notesPath);
        $normalizedPrompt = agent_render_prompt_schema($requestSchema, $runtime['runtime_context_lines'], $notes);

        return [
            'status' => 200,
            'request_schema' => $requestSchema,
            'normalized_prompt' => $normalizedPrompt,
            'messages' => [
                [
                    'role' => 'system',
                    'content' => agent_get_system_message(),
                ],
                [
                    'role' => 'user',
                    'content' => $normalizedPrompt,
                ],
            ],
            'scope' => $runtime['scope'],
            'view' => $runtime['view'],
        ];
    }
}

?>
