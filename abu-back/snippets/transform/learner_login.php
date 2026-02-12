<?php
// Flatten classroom + school data for learner login response.
$classroom = is_array($value) ? $value : [];
$classroomId = $classroom['id'] ?? null;
$school = is_array($classroom['school'] ?? null) ? $classroom['school'] : [];

$data['classroom'] = $classroomId;
$data['school'] = $school['id'] ?? null;
$data['school_name'] = $school['name'] ?? null;
$data['school_css'] = $school['ci_css'] ?? '';
?>
