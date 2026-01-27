{ pkgs, ... }: {
  channel = "stable-24.05";

  # Apenas os pacotes essenciais para o nosso PWA
  packages = [
    pkgs.nodejs_20
    pkgs.nodePackages.live-server # Nosso servidor de teste simples
  ];

  idx = {
    extensions = [
      "google.gemini-cli-vscode-ide-companion"
      "ritwickdey.liveserver"
    ];
  };
}
