# Server Runner

## Visão Geral

**Server Runner** é um aplicativo desktop para gerenciar servidores
locais em um único painel.

O usuário importa uma pasta contendo um projeto/servidor e, a partir
desse momento, o Server Runner passa a controlar sua execução,
monitoramento e exposição pública.

A aplicação **não copia arquivos**. Ela utiliza a própria pasta original
do projeto, portanto qualquer alteração feita pelo usuário é refletida
imediatamente.

------------------------------------------------------------------------

# Objetivos

-   Centralizar todos os servidores locais.
-   Evitar dezenas de terminais abertos.
-   Facilitar iniciar, parar e monitorar servidores.
-   Expor servidores pela internet usando LocalTunnel.
-   Exibir consumo de recursos em tempo real.

------------------------------------------------------------------------

# Fluxo de uso

1.  Clicar em **Importar servidor**.
2.  Selecionar a pasta do projeto.
3.  Informar:
    -   Nome do servidor
    -   Arquivo principal (quando necessário)
    -   Comando para iniciar
    -   Porta (ou detectar automaticamente futuramente)
    -   Ícone personalizado (opcional)
4.  O servidor aparece no Dashboard.
5.  O usuário pode iniciar, parar, reiniciar e abrir o terminal.

------------------------------------------------------------------------

# Dashboard

Cada servidor aparece como um card contendo:

-   Ícone personalizado
-   Nome
-   Status (Online/Offline)
-   Porta
-   URL Local
-   URL Pública (LocalTunnel)
-   Tempo em execução
-   CPU
-   RAM
-   Rede (Upload/Download)

A aplicação suporta qualquer quantidade de projetos importados.

------------------------------------------------------------------------

# Terminal

Ao clicar em um servidor é aberta uma nova janela independente.

Cada servidor possui sua própria janela.

É possível deixar várias janelas abertas simultaneamente.

Essa janela exibe:

-   Logs em tempo real
-   Entrada de comandos
-   Status da execução

------------------------------------------------------------------------

# Monitoramento

## Geral

Mostrar apenas o consumo dos servidores iniciados pelo Server Runner:

-   CPU total
-   RAM total
-   Upload total
-   Download total

Também mostrar os recursos da máquina para comparação.

## Individual

Cada servidor mostra:

-   CPU
-   RAM
-   Rede
-   Tempo de execução

------------------------------------------------------------------------

# LocalTunnel

Cada servidor poderá ser exposto através do LocalTunnel.

O Dashboard exibirá:

-   URL Local
-   URL Pública

Com opção para copiar a URL.

------------------------------------------------------------------------

# Ícones

Cada projeto poderá possuir um ícone próprio.

O usuário poderá escolher uma imagem para representar o servidor.

Isso facilita identificar rapidamente cada projeto.

------------------------------------------------------------------------

# Diferenciais

-   Interface moderna.
-   Múltiplos servidores simultaneamente.
-   Múltiplas janelas de terminal.
-   Recursos monitorados em tempo real.
-   Dashboard único para todos os projetos.
-   Configuração simples na importação.
-   Trabalha diretamente na pasta original do projeto.

------------------------------------------------------------------------

# Tecnologias sugeridas

-   Electron
-   Node.js
-   LocalTunnel
-   node-pty (terminal)
-   systeminformation (CPU, RAM, rede)
-   chokidar (monitoramento de arquivos)

------------------------------------------------------------------------

# MVP

-   Importar servidor
-   Salvar configuração
-   Iniciar servidor
-   Parar servidor
-   Reiniciar servidor
-   Dashboard
-   Janela de terminal
-   Monitoramento de CPU/RAM/Rede
-   LocalTunnel
-   Ícone personalizado
