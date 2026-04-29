<?php

// Öffentliche Liste aktueller Sheets (ohne Auth).
// Optional gefiltert über Lernenden-Code.

function build_sheet_summary($content)
{
    $text = trim(preg_replace('/\s+/', ' ', strip_tags((string) $content)));
    if ($text === '') return '';
    if (function_exists('mb_strlen') && function_exists('mb_substr')) {
        if (mb_strlen($text) <= 180) return $text;
        return mb_substr($text, 0, 177) . '...';
    }
    if (strlen($text) <= 180) return $text;
    return substr($text, 0, 177) . '...';
}

function build_sheet_progress_seed($content)
{
    $html = (string) $content;
    $lueckeTotal = preg_match_all('/<\s*luecke-gap(?:-wide)?\b/i', $html, $ignore);
    $freitextTotal = preg_match_all('/<\s*freitext-block\b/i', $html, $ignore2);
    $total = max(0, intval($lueckeTotal) + intval($freitextTotal));

    return [
        'answered' => 0,
        'total' => $total,
        'percent' => 0,
        'quality_percent' => null,
        'quality_label' => $total > 0 ? 'Nicht begonnen' : 'Keine Aufgaben',
        'quality_count' => 0,
    ];
}

function public_list_answer_table_has_column($column)
{
    static $cache = [];
    $name = trim((string) $column);
    if ($name === '') return false;
    if (array_key_exists($name, $cache)) return $cache[$name];
    $rows = sql_get(
        'SHOW COLUMNS FROM `answer` LIKE "' . sql_escape($name) . '";'
    );
    $cache[$name] = !empty($rows);
    return $cache[$name];
}

function public_list_cookie_value($prefix, $classroomId, $sheetKey)
{
    $classId = intval($classroomId);
    $key = trim((string) $sheetKey);
    if ($classId <= 0 || $key === '') return '';

    $name = trim((string) $prefix) . '.' . $classId . '.' . $key;
    $candidates = [
        $name,
        str_replace('.', '_', $name),
    ];
    foreach ($candidates as $candidate) {
        if (isset($_COOKIE[$candidate]) && trim((string) $_COOKIE[$candidate]) !== '') {
            return trim((string) $_COOKIE[$candidate]);
        }
    }
    return '';
}

function build_sheet_progress_map($rows, $learner)
{
    $progressBySheet = [];
    foreach ($rows as $row) {
        $sheetKey = trim((string) ($row['key'] ?? ''));
        if ($sheetKey === '') continue;
        $progressBySheet[$sheetKey] = build_sheet_progress_seed($row['content'] ?? '');
    }
    if (empty($progressBySheet)) return $progressBySheet;

    $hasClassroomColumn = public_list_answer_table_has_column('classroom');
    $hasClassificationColumn = public_list_answer_table_has_column('classification');
    $answerConditions = [];

    foreach ($rows as $row) {
        $sheetKey = trim((string) ($row['key'] ?? ''));
        if ($sheetKey === '') continue;

        $assignmentForm = strtolower(trim((string) ($row['assignment_form'] ?? '')));
        $answerUser = trim((string) ($learner['code'] ?? ''));
        if ($assignmentForm === 'anonym') {
            $answerUser = public_list_cookie_value('abu.anon.runtime', $learner['classroom'] ?? 0, $sheetKey);
        }
        if ($answerUser === '') continue;

        $answerConditions[] =
            '(`sheet` = "' .
            sql_escape($sheetKey) .
            '" AND `user` = "' .
            sql_escape($answerUser) .
            '")';
    }

    if (empty($answerConditions)) return $progressBySheet;

    $selectFields = ['id', 'sheet', '`key`', 'value', 'updated_at'];
    if ($hasClassificationColumn) {
        $selectFields[] = 'classification';
    }
    if ($hasClassroomColumn) {
        $selectFields[] = 'classroom';
    }

    $query =
        'SELECT ' .
        implode(', ', $selectFields) .
        ' FROM `answer` WHERE (' .
        implode(' OR ', $answerConditions) .
        ')';
    if ($hasClassroomColumn && !empty($learner['classroom'])) {
        $query .= ' AND classroom = ' . intval($learner['classroom']);
    }
    $query .= ' ORDER BY `sheet` ASC, `key` ASC, updated_at DESC, id DESC;';

    $answers = sql_get($query);
    $latestBySheetAndKey = [];
    foreach ($answers as $entry) {
        $sheetKey = trim((string) ($entry['sheet'] ?? ''));
        $answerKey = trim((string) ($entry['key'] ?? ''));
        if ($sheetKey === '' || $answerKey === '') continue;
        if (!isset($latestBySheetAndKey[$sheetKey])) {
            $latestBySheetAndKey[$sheetKey] = [];
        }
        if (!array_key_exists($answerKey, $latestBySheetAndKey[$sheetKey])) {
            $latestBySheetAndKey[$sheetKey][$answerKey] = $entry;
        }
    }

    foreach ($progressBySheet as $sheetKey => $progress) {
        $latestEntries = array_values($latestBySheetAndKey[$sheetKey] ?? []);
        $answered = 0;
        $qualityCount = 0;
        $qualitySum = 0;

        foreach ($latestEntries as $entry) {
            $value = trim((string) ($entry['value'] ?? ''));
            if ($value === '') continue;

            $answered++;
            if ($hasClassificationColumn && isset($entry['classification']) && $entry['classification'] !== '') {
                $score = intval($entry['classification']);
                if ($score < 0) $score = 0;
                if ($score > 1000) $score = 1000;
                $qualitySum += $score;
                $qualityCount++;
            }
        }

        $total = intval($progress['total'] ?? 0);
        if ($total <= 0 && $answered > 0) {
            $total = $answered;
        } elseif ($answered > $total) {
            $total = $answered;
        }

        $percent = $total > 0 ? (int) round(($answered / $total) * 100) : 0;
        $qualityPercent = $qualityCount > 0 ? (int) round(($qualitySum / $qualityCount) / 10) : null;

        if ($qualityPercent === null) {
            $qualityLabel = $answered > 0 ? 'Noch ohne Bewertung' : ($total > 0 ? 'Nicht begonnen' : 'Keine Aufgaben');
        } elseif ($qualityPercent >= 75) {
            $qualityLabel = 'Gut gelöst';
        } elseif ($qualityPercent >= 35) {
            $qualityLabel = 'Teilweise gelöst';
        } else {
            $qualityLabel = 'Noch offen';
        }

        $progressBySheet[$sheetKey] = [
            'answered' => $answered,
            'total' => $total,
            'percent' => $percent,
            'quality_percent' => $qualityPercent,
            'quality_label' => $qualityLabel,
            'quality_count' => $qualityCount,
        ];
    }

    return $progressBySheet;
}

$code = trim($_GET['code'] ?? '');
if ($code !== '') {
    $learner = sql_get(
        'SELECT id, user, classroom, code FROM `learner` WHERE code = "' .
            sql_escape($code) .
            '" LIMIT 1;'
    );
    if (!count($learner)) {
        $return['status'] = 401;
        warning('code ungültig');
        $return['data'] = ['sheet' => []];
        return;
    }
    $learner = $learner[0];

    $rows = sql_get(
        'SELECT DISTINCT s.`key`, s.`name`, s.content, s.updated_at, s.created_at,
            cs.status AS assignment_status, cs.assignment_form
         FROM `sheet` s
         INNER JOIN `classroom_sheet` cs
            ON cs.sheet_key = s.`key`
            AND cs.classroom = ' . intval($learner['classroom']) . '
            AND cs.user = ' . intval($learner['user']) . '
            AND cs.status IN ("aktiv", "freiwillig", "vergangen", "archiviert")
         WHERE s.is_current = 1
           AND s.user = ' . intval($learner['user']) . '
         ORDER BY
            CASE
                WHEN cs.status = "aktiv" THEN 1
                WHEN cs.status = "vergangen" THEN 2
                WHEN cs.status = "freiwillig" THEN 3
                WHEN cs.status = "archiviert" THEN 4
                ELSE 5
            END,
            s.updated_at DESC;'
    );

    $progressBySheet = build_sheet_progress_map($rows, $learner);

    foreach ($rows as &$row) {
        $sheetKey = trim((string) ($row['key'] ?? ''));
        $row['summary'] = build_sheet_summary($row['content'] ?? '');
        $row['progress'] = $progressBySheet[$sheetKey] ?? build_sheet_progress_seed($row['content'] ?? '');
        unset($row['content']);
    }
    unset($row);

    $return['data'] = ['sheet' => $rows];
    return;
}

$rows = sql_get(
    'SELECT `key`, `name`, content, updated_at, created_at
     FROM `sheet`
     WHERE is_current = 1
     ORDER BY updated_at DESC;'
);
foreach ($rows as &$row) {
    $row['summary'] = build_sheet_summary($row['content'] ?? '');
    unset($row['content']);
}
unset($row);

$return['data'] = ['sheet' => $rows];
return;

?>
