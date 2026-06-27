# TANKY — Batalha de Tanques por Turnos

Feito por **Caio Henrique Barros Vilela**.

Jogo de artilharia por turnos em **canvas puro** (HTML + CSS + JavaScript), sem dependências e sem build. Terreno destrutível pixel a pixel, física de projéteis com vento e gravidade, e uma porção de armas, modos, cenários e DLCs.

## Como jogar

Abra o `index.html` no navegador. É só isso — não precisa instalar nada.

### Controles
- **← →** mover o tanque (gasta combustível)
- **↑ ↓** ajustar o ângulo do canhão
- **SEGURAR ESPAÇO** carrega a potência; **soltar** atira
- **Q / E** trocar de arma
- **Segurar V** acelera a partida em 20x

## Modos

- **2 Jogadores** — hot-seat, um contra o outro
- **VS COM** — contra a inteligência artificial
- **Giga Battle** — até **43 tanques por time**, cada um configurável como jogador ou COM (botão **MAX** para encher os dois times)
- **Sandbox** — vida altíssima para testar à vontade; inclui a arma **Ctrl + D**, que apaga toda a terra do mapa

## Armas

Tiro Normal, Bomba Pesada, Cluster, Bomba Relógio, Bombroca (dardo), Saltitante, Bombardeio, Napalm, Soprador, Turbo (voo propulsionado que explode o chão) e Ímã (míssil teleguiado).

## Loja DLC

Ganhe moedas vencendo batalhas e desbloqueie pacotes (salvos no navegador) com armas novas (Buraco Negro, Chuva de Meteoros, Ogiva Nuclear e mais), skins de tanque, cenários com física própria (Noite, Lua, Espaço, Gelo, Inferno...) e modos de jogo extras.

## Fases / Arenas

- **Padrão** — times lado a lado em terreno ondulado
- **Plataforma** — uma fileira de terra no meio (time verde em cima) e um piso embaixo (time vermelho)

## Estrutura

| Arquivo | Conteúdo |
|---------|----------|
| `index.html` | marcação da página e HUD |
| `style.css` | estilos do HUD, menu e loja |
| `game.js` | motor do jogo (física, IA, render, turnos) |
| `pixelart.js` | sistema de ícones em pixel art |
| `dlc.js` | dados dos DLCs, loja e progresso |
