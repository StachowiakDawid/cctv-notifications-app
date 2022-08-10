<?php
namespace App\Domain;

use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\ManyToOne;
use Doctrine\ORM\Mapping\JoinColumn;
use Doctrine\ORM\Mapping\Entity;
use Doctrine\ORM\Mapping\GeneratedValue;
use Doctrine\ORM\Mapping\Id;
use Doctrine\ORM\Mapping\Table;

#[Entity, Table(name: 'messages')]
class Message
{
    #[Id, Column(type: 'integer'), GeneratedValue(strategy: 'AUTO')]
    public int $id;

    #[ManyToOne(targetEntity: Recipient::class)]
    #[JoinColumn(name: "recipient_id", referencedColumnName: "id", nullable: false)]
    public Recipient $recipient;

    #[Column(type: 'string', nullable: false)]
    public string $content;

    #[Column(type: 'boolean', nullable: false)]
    public bool $sent;

    public function __construct(Recipient $recipient, string $content)
    {
        $this->recipient = $recipient;
        $this->content = $content;
        $this->sent = false;
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getRecipient(): Recipient
    {
        return $this->recipient;
    }

    public function getContent(): string
    {
        return $this->content;
    }

    public function isSent(): bool 
    {
        return $this->sent;
    }

    public function markAsSent(): void
    {
        $this->sent = true;
    }
}

