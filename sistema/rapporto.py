"""Rapporto HTML di una simulazione: grafico di umidità, serbatoio e pompa, riepilogo ed eventi. Un solo file, offline."""
import html

COLORI = ["#2a78d4", "#d4772a", "#3a9a5b", "#9a3a8c"]


def _linea(punti, x0, larg, y0, alt, vmax, n):
    passi = []
    for k, v in punti:
        if v is None:
            continue
        passi.append("%.1f,%.1f" % (x0 + k / max(n - 1, 1) * larg, y0 + alt - min(v, vmax) / vmax * alt))
    return " ".join(passi)


def scrivi_rapporto(r, percorso):
    righe = r["righe"]
    n = len(righe)
    L, A, X0, Y0 = 900, 260, 50, 20
    nz = len(r["zone"])
    serie = []
    for i in range(nz):
        pts = [(k, row["u%d_vera" % (i + 1)]) for k, row in enumerate(righe)]
        serie.append('<polyline fill="none" stroke="%s" stroke-width="1.5" points="%s"/>'
                     % (COLORI[i % 4], _linea(pts, X0, L, Y0, A, 1.0, n)))
    cap = r["capacita_serbatoio"]
    pts = [(k, row["serbatoio_l"] / cap) for k, row in enumerate(righe)]
    serie.append('<polyline fill="none" stroke="var(--grigio)" stroke-dasharray="4 3" stroke-width="1.5" points="%s"/>'
                 % _linea(pts, X0, L, Y0, A, 1.0, n))
    pompa = "".join('<rect x="%.1f" y="%d" width="%.1f" height="8" fill="var(--testo)"/>'
                    % (X0 + k / max(n - 1, 1) * L, Y0 + A + 8, max(L / n, 0.8)) for k, row in enumerate(righe)
                    if row["pompa"])
    soglie = "".join('<line x1="%d" x2="%d" y1="%.1f" y2="%.1f" stroke="var(--griglia)"/>'
                     '<text x="%d" y="%.1f" class="asse">%d%%</text>'
                     % (X0, X0 + L, Y0 + A - v * A, Y0 + A - v * A, X0 - 8, Y0 + A - v * A + 4, v * 100)
                     for v in (0, 0.3, 0.45, 0.7, 1.0))
    giorni = righe[-1]["giorno"]
    tacche = "".join('<text x="%.1f" y="%d" class="asse" text-anchor="middle">g%d</text>'
                     % (X0 + (g - 1) / giorni * L, Y0 + A + 34, g) for g in range(1, giorni + 1, max(1, giorni // 10)))
    legenda = "".join('<span><i style="background:%s"></i>zona %d %s</span>'
                      % (COLORI[i % 4], i + 1, html.escape(z["nome"])) for i, z in enumerate(r["zone"]))
    zone = "".join("<tr><td>zona %d %s</td><td>%d</td><td>%d</td></tr>"
                   % (i + 1, html.escape(z["nome"]), r["ore_stress"][i], r["ore_ristagno"][i])
                   for i, z in enumerate(r["zone"]))
    eventi = "".join("<tr><td>g%d %02d:%02d</td><td>%s</td><td>%s</td></tr>"
                     % (m // 1440 + 1, m % 1440 // 60, m % 60, html.escape(a), html.escape(c))
                     for m, a, c in r["eventi"][:200]) or '<tr><td colspan="3">nessun evento</td></tr>'
    pagina = """<!doctype html><html lang="it"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Simulazione %(nome)s</title>
<style>
:root{--sfondo:#fbfaf7;--testo:#1f2421;--grigio:#7b817d;--griglia:#e3e1db;--carta:#ffffff}
@media (prefers-color-scheme:dark){:root{--sfondo:#161a18;--testo:#e8ebe9;--grigio:#9aa29d;--griglia:#2c322f;--carta:#1e2321}}
body{background:var(--sfondo);color:var(--testo);font:15px/1.5 system-ui,sans-serif;margin:0;padding:16px}
main{max-width:980px;margin:auto}svg{width:100%%;height:auto;background:var(--carta);border-radius:8px}
.asse{font-size:11px;fill:var(--grigio)}table{border-collapse:collapse;width:100%%;margin:8px 0 24px}
td,th{border-bottom:1px solid var(--griglia);padding:4px 8px;text-align:left}
.leg span{margin-right:16px;white-space:nowrap}.leg i{display:inline-block;width:12px;height:3px;margin-right:6px;vertical-align:middle}
</style></head><body><main>
<h1>Scenario: %(nome)s</h1><p>%(descrizione)s</p>
<p class="leg">%(legenda)s<span><i style="background:var(--grigio)"></i>cisterna, %% della capacità (tratteggio)</span>
<span><i style="background:var(--testo)"></i>pompa accesa (barra in basso)</span></p>
<svg viewBox="0 0 %(lv)d %(av)d" role="img" aria-label="Umidità del terreno, serbatoio e pompa nel tempo">
%(soglie)s%(serie)s%(pompa)s%(tacche)s</svg>
<p>Linee guida: 30%% sofferenza, 45%% inizio irrigazione, 70%% fine irrigazione.</p>
<h2>Riepilogo</h2><table><tr><th>zona</th><th>ore in sofferenza</th><th>ore di ristagno</th></tr>%(zone)s</table>
<p>Acqua usata: %(litri).0f L · pompa accesa %(pm)d min · pompa a secco %(secco)d min · serbatoio finale %(sf).0f L</p>
<h2>Eventi e allarmi</h2><table><tr><th>quando</th><th>evento</th><th></th></tr>%(eventi)s</table>
</main></body></html>""" % {
        "nome": html.escape(r["nome"]), "descrizione": html.escape(r["descrizione"]), "legenda": legenda,
        "lv": X0 + L + 20, "av": Y0 + A + 44, "soglie": soglie, "serie": "".join(serie), "pompa": pompa,
        "tacche": tacche, "zone": zone, "litri": r["litri"], "pm": r["pompa_minuti"], "secco": r["minuti_a_secco"],
        "sf": r["serbatoio_finale"], "eventi": eventi}
    with open(percorso, "w", encoding="utf-8") as f:
        f.write(pagina)
