<?php

$collectionSheetConfig = [
    'collection_sheet' => [
        'id' => [],
        'user' => [],
        'collection' => [],
        'sheet_key' => [],
        'position' => [],
        'created_at' => [],
        'updated_at' => [],
    ],
];

function normalize_collection_position($value) {
    if ($value === null || $value === '') return null;
    $position = intval($value);
    if ($position <= 0) return 1;
    return $position;
}

function collection_row_for_user($collectionId, $userId) {
    $rows = sql_get(
        'SELECT id, user, name FROM `collection` WHERE id = ' .
            intval($collectionId) .
            ' AND user = ' .
            intval($userId) .
            ' LIMIT 1;'
    );
    return $rows[0] ?? null;
}

function move_collection_sheet_to_position($entryId, $collectionId, $userId, $targetPosition = null) {
    $rows = sql_get(
        'SELECT id FROM `collection_sheet` WHERE collection = ' .
            intval($collectionId) .
            ' AND user = ' .
            intval($userId) .
            ' ORDER BY position ASC, id ASC;'
    );
    if (!count($rows)) return;

    $orderedIds = [];
    foreach ($rows as $row) {
        $rowId = intval($row['id'] ?? 0);
        if ($rowId > 0 && $rowId !== intval($entryId)) {
            $orderedIds[] = $rowId;
        }
    }

    if (intval($entryId) > 0) {
        $targetIndex = count($orderedIds);
        if ($targetPosition !== null) {
            $targetIndex = max(0, min(count($orderedIds), intval($targetPosition) - 1));
        }
        array_splice($orderedIds, $targetIndex, 0, [intval($entryId)]);
    }
    $now = date('Y-m-d H:i:s');
    foreach ($orderedIds as $index => $rowId) {
        sql_set(
            'UPDATE `collection_sheet` SET position = ' .
                intval($index + 1) .
                ', updated_at = "' .
                sql_escape($now) .
                '" WHERE id = ' .
                intval($rowId) .
                ' AND user = ' .
                intval($userId) .
                ';'
        );
    }
}

if (!isset($user['id'])) {
    $return['status'] = 401;
    warning('nicht eingeloggt');
    return;
}

if ($method === 'GET') {
    $where = [];
    $scopeToCurrentUser = !user_is_admin();
    if ($scopeToCurrentUser) {
        $where[] = 'user = ' . intval($user['id']);
    }
    if (!empty($paras[0])) {
        $where[] = 'id = ' . intval($paras[0]);
    }
    if (!empty($_GET['collection'])) {
        $where[] = 'collection = ' . intval($_GET['collection']);
    }
    if (!empty($_GET['sheet_key'])) {
        $where[] = '`sheet_key` = "' . sql_escape(trim($_GET['sheet_key'])) . '"';
    }
    $collectionSheetConfig['collection_sheet']['_where'] = $where;
    $collectionSheetConfig['collection_sheet']['_append'] = ['ORDER BY collection ASC, position ASC, id ASC'];
    $result = get($collectionSheetConfig);
    if (!empty($paras[0])) {
        $return['data'] = $result['collection_sheet'][0] ?? [];
    } else {
        $return['data'] = $result;
    }
    return;
}

if ($method === 'POST') {
    $collectionId = intval($data['collection'] ?? 0);
    $sheetKey = trim((string) ($data['sheet_key'] ?? ($data['sheet'] ?? '')));
    $position = normalize_collection_position($data['position'] ?? null);
    if ($collectionId <= 0) {
        $return['status'] = 400;
        warning('collection fehlt');
        return;
    }
    if ($sheetKey === '') {
        $return['status'] = 400;
        warning('sheet_key fehlt');
        return;
    }

    $collection = collection_row_for_user($collectionId, $user['id']);
    if (!$collection) {
        $return['status'] = 404;
        warning('sammlung nicht gefunden');
        return;
    }

    $sheet = sql_get(
        'SELECT id FROM `sheet` WHERE user = ' .
            intval($user['id']) .
            ' AND `key` = "' .
            sql_escape($sheetKey) .
            '" LIMIT 1;'
    );
    if (!count($sheet)) {
        $return['status'] = 404;
        warning('sheet nicht gefunden');
        return;
    }

    $existingInOtherCollection = sql_get(
        'SELECT id, collection FROM `collection_sheet` WHERE user = ' .
            intval($user['id']) .
            ' AND sheet_key = "' .
            sql_escape($sheetKey) .
            '" AND collection != ' .
            intval($collectionId) .
            ' LIMIT 1;'
    );
    if (!empty($existingInOtherCollection)) {
        $return['status'] = 409;
        warning('sheet ist bereits einer anderen sammlung zugeordnet');
        return;
    }

    $existing = sql_get(
        'SELECT id FROM `collection_sheet` WHERE user = ' .
            intval($user['id']) .
            ' AND collection = ' .
            intval($collectionId) .
            ' AND sheet_key = "' .
            sql_escape($sheetKey) .
            '" LIMIT 1;'
    );
    if (!empty($existing)) {
        if ($position !== null) {
            move_collection_sheet_to_position(
                intval($existing[0]['id']),
                $collectionId,
                intval($user['id']),
                $position
            );
        }
        $return['data'] = ['id' => intval($existing[0]['id'])];
        return;
    }

    $now = date('Y-m-d H:i:s');
    $newId = sql_set(
        'INSERT INTO `collection_sheet` (user, collection, sheet_key, position, created_at, updated_at) VALUES (' .
            intval($user['id']) .
            ', ' .
            intval($collectionId) .
            ', "' .
            sql_escape($sheetKey) .
            '", 999999, "' .
            sql_escape($now) .
            '", "' .
            sql_escape($now) .
            '");',
        true
    );
    move_collection_sheet_to_position(
        intval($newId),
        $collectionId,
        intval($user['id']),
        $position
    );
    $return['data'] = ['id' => intval($newId)];
    return;
}

if ($method === 'PUT' || $method === 'PATCH') {
    $id = $data['id'] ?? ($paras[0] ?? null);
    if (!$id) {
        $return['status'] = 400;
        warning('id fehlt');
        return;
    }

    $existing = sql_get(
        'SELECT id, collection, sheet_key FROM `collection_sheet` WHERE id = ' .
            intval($id) .
            ' AND user = ' .
            intval($user['id']) .
            ' LIMIT 1;'
    );
    if (!count($existing)) {
        $return['status'] = 404;
        warning('zuordnung nicht gefunden');
        return;
    }
    $existing = $existing[0];

    if (array_key_exists('collection', $data)) {
        $targetCollectionId = intval($data['collection'] ?? 0);
        $targetPosition = array_key_exists('position', $data)
            ? normalize_collection_position($data['position'] ?? null)
            : null;
        if ($targetCollectionId <= 0) {
            $return['status'] = 400;
            warning('collection fehlt');
            return;
        }

        $targetCollection = collection_row_for_user($targetCollectionId, $user['id']);
        if (!$targetCollection) {
            $return['status'] = 404;
            warning('sammlung nicht gefunden');
            return;
        }

        $currentCollectionId = intval($existing['collection']);
        if ($targetCollectionId === $currentCollectionId) {
            if ($targetPosition !== null) {
                move_collection_sheet_to_position(
                    intval($existing['id']),
                    $currentCollectionId,
                    intval($user['id']),
                    $targetPosition
                );
            }
            return;
        }

        $now = date('Y-m-d H:i:s');
        sql_set(
            'UPDATE `collection_sheet` SET collection = ' .
                intval($targetCollectionId) .
                ', position = 999999, updated_at = "' .
                sql_escape($now) .
                '" WHERE id = ' .
                intval($existing['id']) .
                ' AND user = ' .
                intval($user['id']) .
                ';'
        );
        move_collection_sheet_to_position(
            intval($existing['id']),
            $targetCollectionId,
            intval($user['id']),
            $targetPosition
        );
        move_collection_sheet_to_position(
            -1,
            $currentCollectionId,
            intval($user['id']),
            null
        );
        return;
    }

    if (array_key_exists('position', $data)) {
        $position = normalize_collection_position($data['position'] ?? null);
        move_collection_sheet_to_position(
            intval($existing['id']),
            intval($existing['collection']),
            intval($user['id']),
            $position
        );
        return;
    }

    $return['status'] = 400;
    warning('keine aenderung uebermittelt');
    return;
}

if ($method === 'DELETE') {
    $id = $data['id'] ?? ($paras[0] ?? null);
    $collectionId = intval($data['collection'] ?? 0);
    $sheetKey = trim((string) ($data['sheet_key'] ?? ($data['sheet'] ?? '')));

    if (!$id && ($collectionId <= 0 || $sheetKey === '')) {
        $return['status'] = 400;
        warning('id fehlt');
        return;
    }

    if ($id) {
        $existing = sql_get(
            'SELECT id, collection FROM `collection_sheet` WHERE id = ' .
                intval($id) .
                ' AND user = ' .
                intval($user['id']) .
                ' LIMIT 1;'
        );
    } else {
        $existing = sql_get(
            'SELECT id, collection FROM `collection_sheet` WHERE collection = ' .
                intval($collectionId) .
                ' AND user = ' .
                intval($user['id']) .
                ' AND sheet_key = "' .
                sql_escape($sheetKey) .
                '" LIMIT 1;'
        );
    }

    if (!count($existing)) {
        $return['status'] = 404;
        warning('zuordnung nicht gefunden');
        return;
    }

    $target = $existing[0];
    sql_delete('collection_sheet', intval($target['id']));
    move_collection_sheet_to_position(
        -1,
        intval($target['collection']),
        intval($user['id']),
        null
    );
    return;
}

$return['status'] = 405;
warning('Methode nicht erlaubt');

?>
