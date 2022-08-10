<?php
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Factory\AppFactory;
use UMA\DIC\Container;
use Doctrine\ORM\EntityManager;
use App\MessageService;
use App\RecipientService;
use App\Domain\Message;
use App\Domain\Recipient;
require __DIR__ . '/../vendor/autoload.php';
$container = require_once __DIR__ . '/../bootstrap.php';
$app = AppFactory::create(container: $container);
$app->addBodyParsingMiddleware();
$app->addErrorMiddleware(true, true, true);
$app->add(new RKA\Middleware\IpAddress());

$app->get('/get-tokens', function (Request $request, Response $response, $args) {
    if ($request->getAttribute('ip_address') == '127.0.0.1') {
        $response->getBody()->write(json_encode($this->get(RecipientService::class)->getTokens()));
        return $response;
    } else {
        return $response->withStatus(403);
    }
});

$app->post('/new-message', function (Request $request, Response $response, $args) {
    $response->getBody()->write(json_encode($this->get(MessageService::class)->newMessageToAll($request->getParsedBody()['content'])));
    return $response;
    if ($request->getAttribute('ip_address') == '127.0.0.1') {
        $response->getBody()->write(json_encode($this->get(MessageService::class)->newMessageToAll($request->getParsedBody()['content'])));
        return $response;
    } else {
        return $response->withStatus(403);
    }
});

$app->get('/fetch-unsent/{recipient_name}', function (Request $request, Response $response, $args) {
    $em = $this->get(EntityManager::class);
    $recipient = $this->get(RecipientService::class)->getByName($args['recipient_name']);
    $recipient->setLastUpdate(new DateTimeImmutable());
    $em->persist($recipient);
    $em->flush($recipient);
    $messages = $this->get(MessageService::class)->getUnsentMessagesByRecipient($recipient);
    $response->getBody()->write(json_encode($messages));
    return $response->withHeader('Content-Type', 'application/json');
});

$app->post('/confirm-fetching/{recipient_name}', function (Request $request, Response $response, $args) {
    $params = $request->getParsedBody();
    $messages = $params['fetched'];
    $messageService = $this->get(MessageService::class);
    $messageService->markMessagesAsSent($messages);
    return $response->withStatus(200);
});

$app->post('/register-token/{recipient_name}', function (Request $request, Response $response, $args) {
    $recipientService = $this->get(RecipientService::class);
    $recipient = $recipientService->getByName($args['recipient_name']);
    $date = new DateTimeImmutable();
    $params = $request->getParsedBody();
    if ($recipient == null) {
        $recipient = new Recipient($args['recipient_name'], $params['token'], $date);
    } else {
        $recipient->setLastUpdate($date);
        $recipient->setToken($params['token']);
    }
    $em = $this->get(EntityManager::class);
    $em->persist($recipient);
    $em->flush();
    return $response->withStatus(200);
});

$app->run();