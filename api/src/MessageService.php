<?php 
namespace App;
use Doctrine\ORM\EntityManager;
use App\Domain\Message;
use App\Domain\Recipient;

final class MessageService
{
    private EntityManager $em;

    public function __construct(EntityManager $em)
    {
        $this->em = $em;
    }

    public function getUnsentMessagesByRecipient(Recipient $recipient): array {
        return $this->em->getRepository(Message::class)->findBy(['recipient' => $recipient->getId(), 'sent' => false], ['id'=>'ASC']);
    }

    public function markMessagesAsSent(array $messages): void {
        foreach ($messages as $message_id) {
            $message = $this->em->find(Message::class, $message_id);
            if ($message != null) {
                $message->markAsSent();
                $this->em->persist($message);
            }
        }
        $this->em->flush();
    }

    public function newMessageToAll (string $content): array {
        $recipients = $this->em->getRepository(Recipient::class)->findAll();
        foreach ($recipients as $recipient) {
            $message = new Message($recipient, $content);
            $this->em->persist($message);
        }
        $getToken = function (Recipient $recipient): string {
            return $recipient->getToken();
        };
        $this->em->flush();
        return array_map($getToken, $recipients);
    }
}