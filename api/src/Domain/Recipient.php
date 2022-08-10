<?php
namespace App\Domain;

use \DateTimeImmutable;
use Doctrine\ORM\Mapping\Column;
use Doctrine\ORM\Mapping\Entity;
use Doctrine\ORM\Mapping\GeneratedValue;
use Doctrine\ORM\Mapping\Id;
use Doctrine\ORM\Mapping\Table;

#[Entity, Table(name: 'recipients')]
class Recipient
{
    #[Id, Column(type: 'integer'), GeneratedValue(strategy: 'AUTO')]
    public int $id;

    #[Column(type: 'string', unique: true, nullable: false)]
    public string $name;

    #[Column(type: 'string', unique: true, nullable: false)]
    public string $token;

    #[Column(name: 'last_update', type: 'datetime_immutable', unique: false, nullable: false)]
    public DateTimeImmutable $lastUpdate;

    public function __construct(string $name, string $token, DateTimeImmutable $lastUpdate)
    {
        $this->name = $name;
        $this->token = $token;
        $this->lastUpdate = $lastUpdate;
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getToken(): string
    {
        return $this->token;
    }

    public function getLastUpdate(): DateTimeImmutable
    {
        return $this->lastUpdate;
    }

    public function setLastUpdate(DateTimeImmutable $lastUpdate): DateTimeImmutable
    {
        $this->lastUpdate = $lastUpdate;
        return $this->lastUpdate;
    }

    public function setToken(string $token): string
    {
        $this->token = $token;
        return $this->token;
    }
}

