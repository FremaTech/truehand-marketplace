#!/usr/bin/env python3
"""La pagina appena estratta e' quella vera, o una schermata d'attesa?

Legge da stdin il JSON di navigate/extract ed esce con 0 se la pagina e'
pronta, 1 se conviene riprovare fra un attimo.

Serve a chrome-bridge per non consegnare all'agente l'interstiziale di
Cloudflare al posto del contenuto. Il 22.08.2026 e' andata cosi': navigate
estraeva subito, su Upwork tornava titolo "Ci siamo quasi..." e zero link,
l'agente concludeva di non vedere niente e si arrendeva. Dodici secondi dopo
la stessa pagina era leggibile per intero, utente gia' loggato.

Il criterio e' volutamente prudente: nel dubbio si dice PRONTA. Meglio
consegnare una pagina magra che far aspettare venti secondi per niente su un
sito che davvero non ha link (una pagina d'errore, un PDF, una risposta JSON).
Si aspetta solo davanti a segni INEQUIVOCABILI di attesa.
"""
import json
import re
import sys

# Titoli con cui i sistemi anti-bot marcano la pagina di transito, nelle lingue
# che compaiono su questa macchina. Cloudflare traduce in base al browser.
ATTESA_TITOLO = re.compile(
    r"just a moment|checking your browser|un attimo|ci siamo quasi|"
    r"attendere|please wait|verifica in corso|security check|"
    r"un momento|einen moment",
    re.IGNORECASE,
)

# Impronte del corpo: la pagina di sfida di Cloudflare porta sempre un Ray ID,
# e le schermate di transito parlano di verifica della connessione.
ATTESA_CORPO = re.compile(
    r"ray id|cloudflare|enable javascript and cookies|"
    r"verifying you are human|checking if the site connection is secure",
    re.IGNORECASE,
)


def pronta(d: dict) -> bool:
    titolo = str(d.get("title") or "")
    corpo = str(d.get("bodyText") or "")
    link = d.get("links")
    n_link = len(link) if isinstance(link, list) else int(d.get("count") or 0)

    # Titolo di transito: aspetta, senza discutere.
    if ATTESA_TITOLO.search(titolo):
        return False

    # Impronta anti-bot nel corpo E pagina praticamente vuota: e' la sfida.
    # Servono ENTRAMBE: "cloudflare" da solo compare anche in pie' di pagina
    # legittimi, e bocciare quelli vorrebbe dire aspettare venti secondi su
    # mezzo web.
    if ATTESA_CORPO.search(corpo) and len(corpo) < 600 and n_link == 0:
        return False

    # Corpo quasi vuoto e nemmeno un link: tipico della finestra fra il
    # caricamento e il rendering di un'applicazione JavaScript.
    if len(corpo.strip()) < 200 and n_link == 0:
        return False

    return True


def main() -> int:
    try:
        d = json.loads(sys.stdin.read() or "{}")
    except Exception:
        # JSON illeggibile: non e' un problema di attesa, non ha senso ripetere.
        return 0
    if not isinstance(d, dict):
        return 0
    return 0 if pronta(d) else 1


if __name__ == "__main__":
    sys.exit(main())
