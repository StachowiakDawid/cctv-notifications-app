<?php
require 'vendor/autoload.php';
Dotenv\Dotenv::createUnsafeImmutable(__DIR__)->load();
use Google\Client;

function getAccessToken($serviceAccountPath)
{
    $client = new Client();
    $client->setAuthConfig($serviceAccountPath);
    $client->addScope('https://www.googleapis.com/auth/firebase.messaging');
    $client->useApplicationDefaultCredentials();
    $token = $client->fetchAccessTokenWithAssertion();
    return $token['access_token'];
}

function sendMessage($accessToken, $projectId, $message)
{
    $url = 'https://fcm.googleapis.com/v1/projects/' . $projectId . '/messages:send';
    $headers = [
        'Authorization: Bearer ' . $accessToken,
        'Content-Type: application/json',
    ];
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['message' => $message]));
    $response = curl_exec($ch);
    if ($response === false) {
        throw new Exception('Curl error: ' . curl_error($ch));
    }
    curl_close($ch);
    return json_decode($response, true);
}

$serviceAccountPath = $_ENV['FIREBASE_SERVICE_ACCOUNT_PATH'];
$projectId = 'cctv-notifications-app';
$message = [
    'token' => $_ENV['FIREBASE_TOKEN'],
    'notification' => [
        'title' => 'Wykryto ruch',
        'body' => 'Data godzina',
    ],
    'data' => [
        'url' => 'https://google.com'
    ],
    'android' => [
        'priority' => 'high'
    ]
];

try {
    $accessToken = getAccessToken($serviceAccountPath);
    $response = sendMessage($accessToken, $projectId, $message);
    echo 'Message sent successfully: ' . print_r($response, true);
} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage();
}