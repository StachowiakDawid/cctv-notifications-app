<?php 
namespace App;
use App\Domain\Recipient;
use Doctrine\ORM\EntityManager;

final class RecipientService
{
    private EntityManager $em;

    public function __construct(EntityManager $em)
    {
        $this->em = $em;
    }

    public function getByName(string $recipient): Recipient | null {
        return $this->em->getRepository(Recipient::class)->findOneBy(['name' => $recipient]);
    }

    public function getTokens(): array {
        $recipients = $this->em->getRepository(Recipient::class)->findAll();
        $getToken = function (Recipient $recipient): string {
            return $recipient->getToken();
        };
        return array_map($getToken, $recipients);
    }
}