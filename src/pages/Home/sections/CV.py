# Génère le CV + Book de Caleb AGBAKOU (2 pages A4)
# Usage : pip install reportlab  &&  python build_cv_book.py
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.colors import HexColor, Color
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph
from reportlab.lib.styles import ParagraphStyle
from reportlab.graphics.barcode import qr
from reportlab.graphics.shapes import Drawing
from reportlab.graphics import renderPDF

import os
# --- Configuration -----------------------------------------------------------
# Dossier contenant Poppins-Regular/Light/Medium/Bold/Italic.ttf
# (téléchargeables sur https://fonts.google.com/specimen/Poppins)
FD = os.environ.get('FONT_DIR', './fonts').rstrip('/\\') + os.sep

for n, f in [('P', 'Poppins-Regular'), ('PL', 'Poppins-Light'), ('PM', 'Poppins-Medium'),
             ('PB', 'Poppins-Bold'), ('PI', 'Poppins-Italic')]:
    pdfmetrics.registerFont(TTFont(n, FD + f + '.ttf'))

from reportlab.pdfbase.pdfmetrics import registerFontFamily
registerFontFamily('P', normal='P', bold='PB', italic='PI', boldItalic='PB')
registerFontFamily('PL', normal='PL', bold='PM', italic='PL', boldItalic='PM')
registerFontFamily('PM', normal='PM', bold='PB', italic='PM', boldItalic='PB')
INK = HexColor('#080808'); PANEL = HexColor('#141414'); LINE = HexColor('#2A2A2A')
LIME = HexColor('#CCFF00'); LIME2 = HexColor('#99CC00')
SIDE = HexColor('#F1F2EC'); TXT = HexColor('#1C1E21'); MUTED = HexColor('#5A5F66')
WHITE = HexColor('#FFFFFF'); W70 = Color(1, 1, 1, .72)

W, H = A4
PHOTO = os.environ.get('PHOTO', './fonts/profile.webp')   # photo carrée recommandée (ex. 600x600)
SITE = 'https://calebcreative.online'
MAIL = 'calebagbakou@gmail.com'
WA = 'https://wa.me/2290148135395'

def st(font='P', size=9, color=TXT, lead=None, **kw):
    return ParagraphStyle('s', fontName=font, fontSize=size, textColor=color,
                          leading=lead or size * 1.45, **kw)

def para(c, text, x, top, w, style):
    p = Paragraph(text, style)
    _, h = p.wrap(w, 2000)
    p.drawOn(c, x, top - h)
    return top - h

def heading(c, text, x, y, color=TXT):
    c.setFillColor(LIME); c.rect(x, y + 2, 20, 3, stroke=0, fill=1)
    c.setFillColor(color); c.setFont('PB', 8.5)
    c.drawString(x, y - 11, text.upper() if False else text)
    c.setFont('PB', 8.5)
    return y - 26

def link(c, url, x, y, w, h):
    c.linkURL(url, (x, y, x + w, y + h), relative=0)

# ------------------------------------------------------------------ PAGE 1
def page_cv(c):
    band = 190
    c.setFillColor(INK); c.rect(0, H - band, W, band, stroke=0, fill=1)
    c.setFillColor(LIME); c.rect(0, H - band, W, 4, stroke=0, fill=1)
    # photo
    cx, cy, r = 112, H - 100, 62
    c.setFillColor(LIME); c.circle(cx, cy, r + 3.5, stroke=0, fill=1)
    c.saveState()
    p = c.beginPath(); p.circle(cx, cy, r); c.clipPath(p, stroke=0, fill=0)
    c.drawImage(PHOTO, cx - r, cy - r, 2 * r, 2 * r, preserveAspectRatio=True, mask='auto')
    c.restoreState()
    # nom
    x0 = 200
    c.setFillColor(LIME); c.setFont('PM', 8); c.drawString(x0, H - 52, 'CALEB CREATIVE  ·  CRÉATEUR VISUEL AU BÉNIN')
    c.setFillColor(WHITE); c.setFont('PB', 27); c.drawString(x0, H - 86, 'Caleb Jesugnon')
    c.setFillColor(LIME); c.setFont('PB', 27); c.drawString(x0, H - 116, 'AGBAKOU')
    c.setFillColor(WHITE); c.setFont('PM', 10)
    c.drawString(x0, H - 140, 'Vidéo IA  ·  Design  ·  Montage  ·  Motion')
    c.setFillColor(W70); c.setFont('PI', 9)
    c.drawString(x0, H - 160, 'Des idées brutes, des rendus qui claquent.')
    c.setFont('PL', 8); c.drawString(x0, H - 180, 'Abomey, Bénin  ·  calebcreative.online')

    # sidebar
    sb_w = 196
    c.setFillColor(SIDE); c.rect(0, 0, sb_w, H - band, stroke=0, fill=1)
    x = 26; w = sb_w - 2 * x
    y = H - band - 34
    y = heading(c, 'CONTACT', x, y)
    contacts = [('E-MAIL', MAIL, 'mailto:' + MAIL),
                ('WHATSAPP', '+229 01 48 13 53 95', WA),
                ('TÉLÉPHONE', '+229 01 50 25 97 92', 'tel:+22901502597092'),
                ('TIKTOK', '@calebagk', 'https://tiktok.com/@calebagk'),
                ('SITE', 'calebcreative.online', SITE),
                ('LOCALISATION', 'Abomey, Bénin', 'https://www.google.com/maps/search/Abomey+Bénin')]
    for lab, val, url in contacts:
        c.setFillColor(MUTED); c.setFont('PM', 6.5); c.drawString(x, y, lab)
        c.setFillColor(TXT); c.setFont('PM', 8.2); c.drawString(x, y - 11, val)
        link(c, url, x, y - 14, w, 22)
        y -= 31
    y -= 8
    y = heading(c, 'COMPÉTENCES', x, y)
    for s in ['Création d’images IA', 'Création vidéo IA', 'Montage vidéo', 'Design graphique',
              'Motion design', 'Création de logos', 'Retouche photo']:
        c.setFillColor(LIME2); c.rect(x, y + 1, 4, 4, stroke=0, fill=1)
        c.setFillColor(TXT); c.setFont('P', 8.4); c.drawString(x + 11, y, s)
        y -= 16
    y -= 10
    y = heading(c, 'OUTILS', x, y)
    for lab, txt in [('LOGICIELS', 'Photoshop · Premiere Pro · After Effects · CapCut · Canva'),
                     ('INTELLIGENCE ARTIFICIELLE', 'ChatGPT · Midjourney · Seedance · Kling AI · Claude · Leonardo AI · Gemini · Ideogram')]:
        c.setFillColor(MUTED); c.setFont('PM', 6.5); c.drawString(x, y, lab); y -= 4
        y = para(c, txt, x, y, w, st('P', 8.2, TXT, 12)) - 12
    sb_bottom = y

    # colonne droite
    rx = 226; rw = W - rx - 34
    y = H - band - 34
    y = heading(c, 'PROFIL', rx, y)
    y = para(c, ("Depuis près de deux ans, <b>Caleb Jesugnon AGBAKOU</b> met la puissance de l’intelligence "
                 "artificielle au service de la créativité : il transforme des idées en réalisations "
                 "concrètes — images, vidéos, designs, identités visuelles. Attentif au détail, il "
                 "accompagne particuliers, entreprises et organisations dans la conception de contenus "
                 "visuels qui marquent."), rx, y, rw, st('P', 8.5, TXT, 12.6, alignment=4)) - 12
    # chiffres
    bw = (rw - 16) / 3
    for i, (n, l) in enumerate([('40+', 'PROJETS RÉALISÉS'), ('2 ANS', 'D’EXPÉRIENCE'), ('10', 'SERVICES')]):
        bx = rx + i * (bw + 8)
        c.setFillColor(INK); c.roundRect(bx, y - 46, bw, 46, 7, stroke=0, fill=1)
        c.setFillColor(LIME); c.setFont('PB', 15); c.drawCentredString(bx + bw / 2, y - 22, n)
        c.setFillColor(W70); c.setFont('PM', 6.3); c.drawCentredString(bx + bw / 2, y - 36, l)
    y -= 46 + 24
    y = heading(c, 'SERVICES', rx, y)
    services = [
        ('Création de contenu IA', 'Concepts visuels affinés pour vos campagnes, du brief au rendu.'),
        ('Création d’images IA', 'Visuels originaux dirigés et retravaillés pour votre marque.'),
        ('Création de vidéos IA', 'Teasers, publicités et contenus courts.'),
        ('Motion design', 'Animations pour vos logos, titres et interfaces.'),
        ('Montage vidéo professionnel', 'Montage, étalonnage et rythme : vos rushes deviennent un récit.'),
        ('Création d’affiches', 'Supports imprimés qui captent l’attention en un coup d’œil.'),
        ('Création de logos', 'Identités visuelles simples et mémorables, pensées pour durer.'),
        ('Retouche photo IA', 'Correction et sublimation de portraits et photos produit.'),
        ('Prompt engineering', 'Prompts optimisés pour exploiter les IA créatives.'),
        ('Conseil en solutions créatives IA', 'Choix et prise en main des bons outils, sur mesure.'),
    ]
    for i, (t, d) in enumerate(services):
        c.setFillColor(LIME2); c.setFont('PB', 7.5); c.drawString(rx, y - 8, f'{i+1:02d}')
        c.setFillColor(TXT); c.setFont('PB', 8.8); c.drawString(rx + 20, y - 8, t)
        y = para(c, d, rx + 20, y - 12, rw - 20, st('P', 7.9, MUTED, 11)) - 5
    y -= 12
    y = heading(c, 'QUI J’ACCOMPAGNE', rx, y)
    cw = (rw - 16) / 3
    for i, (t, d) in enumerate([('Particuliers', 'Portraits, réseaux sociaux, projets personnels'),
                                ('Entreprises', 'Identité visuelle, contenus marketing, publicités'),
                                ('Organisations', 'Communication institutionnelle et événementielle')]):
        bx = rx + i * (cw + 8)
        c.setFillColor(SIDE); c.roundRect(bx, y - 48, cw, 48, 6, stroke=0, fill=1)
        c.setFillColor(TXT); c.setFont('PB', 8); c.drawString(bx + 8, y - 14, t)
        para(c, d, bx + 8, y - 19, cw - 14, st('P', 6.9, MUTED, 9.2))
    y -= 48
    assert y > 46, f'débordement page 1: y={y}'
    assert sb_bottom > 46, f'débordement sidebar: {sb_bottom}'
    c.setFillColor(MUTED); c.setFont('PL', 7)
    c.drawString(rx, 24, 'Caleb Jesugnon AGBAKOU — CV')
    c.drawRightString(W - 34, 24, 'Page 1 / 2')
    c.showPage()

# ------------------------------------------------------------------ PAGE 2
def page_book(c):
    c.setFillColor(INK); c.rect(0, 0, W, H, stroke=0, fill=1)
    c.setFillColor(LIME); c.rect(0, H - 4, W, 4, stroke=0, fill=1)
    m = 36; cw = W - 2 * m
    c.setFillColor(LIME); c.setFont('PM', 8); c.drawString(m, H - 44, 'BOOK  ·  CALEB CREATIVE')
    c.setFillColor(WHITE); c.setFont('PB', 22)
    c.drawString(m, H - 74, 'Quelques réalisations,')
    c.drawString(m, H - 100, 'une même exigence.')
    y = para(c, ("Images, vidéos, motion, publicités, logos, affiches et retouches : sept univers "
                 "créés avec l’IA et le sens du détail. Le portfolio complet, régulièrement mis à jour, "
                 "est consultable en ligne."), m, H - 112, cw - 120, st('PL', 8.8, W70, 13))
    # grille
    cats = [('01', 'Images IA', 'Visuels originaux dirigés et retravaillés pour votre marque.'),
            ('02', 'Vidéos IA', 'Teasers produit, clips réseaux sociaux, vidéos évènementielles.'),
            ('03', 'Motion Design', 'Intros et habillages de logos animés.'),
            ('04', 'Publicités', 'Créations pour les réseaux sociaux et campagnes display.'),
            ('05', 'Logos', 'Identités visuelles simples et mémorables.'),
            ('06', 'Affiches', 'Supports imprimés pensés pour capter l’attention.'),
            ('07', 'Retouches photo', 'Portraits et photos produit corrigés et sublimés.')]
    gap = 12; bw = (cw - gap) / 2; bh = 78
    top = y - 22
    for i in range(8):
        col, row = i % 2, i // 2
        bx = m + col * (bw + gap); by = top - (row + 1) * bh - row * gap
        if i < 7:
            n, t, d = cats[i]
            c.setFillColor(PANEL); c.setStrokeColor(LINE); c.setLineWidth(.8)
            c.roundRect(bx, by, bw, bh, 9, stroke=1, fill=1)
            # bandeau lime dégradé
            c.saveState()
            p = c.beginPath(); p.roundRect(bx, by, 52, bh, 9); c.clipPath(p, stroke=0, fill=0)
            c.linearGradient(bx, by + bh, bx + 52, by, (LIME, LIME2))
            c.restoreState()
            c.setFillColor(INK); c.setFont('PB', 17); c.drawCentredString(bx + 26, by + bh / 2 - 6, n)
            c.setFillColor(WHITE); c.setFont('PB', 11); c.drawString(bx + 66, by + bh - 28, t)
            para(c, d, bx + 66, by + bh - 34, bw - 80, st('PL', 8, W70, 11.2))
        else:
            c.setFillColor(LIME); c.roundRect(bx, by, bw, bh, 9, stroke=0, fill=1)
            q = qr.QrCodeWidget(SITE + '/#portfolio'); q.barBorder = 0
            b = q.getBounds(); qs = 58
            d = Drawing(qs, qs, transform=[qs / (b[2] - b[0]), 0, 0, qs / (b[3] - b[1]), 0, 0]); d.add(q)
            c.setFillColor(WHITE); c.roundRect(bx + 12, by + 12, qs + 6, qs + 6, 5, stroke=0, fill=1)
            renderPDF.draw(d, c, bx + 15, by + 15)
            c.setFillColor(INK); c.setFont('PB', 10.5); c.drawString(bx + 88, by + bh - 28, 'Portfolio complet')
            para(c, 'Scannez ou cliquez pour voir toutes les réalisations en ligne.',
                 bx + 88, by + bh - 34, bw - 100, st('PM', 7.8, INK, 10.6))
            link(c, SITE + '/#portfolio', bx, by, bw, bh)
    y = top - 4 * bh - 3 * gap - 28

    # processus
    c.setFillColor(LIME); c.setFont('PB', 8.5); c.drawString(m, y, 'MON PROCESSUS'); y -= 14
    steps = [('01', 'IDÉE', 'Brief, références, direction'), ('02', 'DESIGN', 'Composition et identité'),
             ('03', 'MOUVEMENT', 'Animation et montage'), ('04', 'RENDU', 'Export et livraison')]
    sw = (cw - 3 * 8) / 4
    for i, (n, t, d) in enumerate(steps):
        sx = m + i * (sw + 8)
        c.setFillColor(PANEL); c.setStrokeColor(LINE); c.roundRect(sx, y - 54, sw, 54, 7, stroke=1, fill=1)
        c.setFillColor(LIME); c.setFont('PB', 8); c.drawString(sx + 10, y - 17, f'{n} · {t}')
        para(c, d, sx + 10, y - 22, sw - 18, st('PL', 7.6, W70, 10.4))
    y -= 54 + 24

    # délais / paiement
    hw = (cw - 12) / 2; bh2 = 84
    boxes = [('DÉLAIS INDICATIFS',
              '<b>24 à 48 h</b> · visuel simple (image, affiche, retouche)<br/>'
              '<b>3 à 5 jours</b> · vidéo ou motion design<br/>'
              '<b>1 à 2 semaines</b> · campagne complète, plusieurs livrables'),
             ('COLLABORATION ET PAIEMENT',
              'Travail <b>100 % à distance</b>, du brief à la livraison, par WhatsApp ou e-mail.<br/>'
              'Paiement par <b>Mobile Money</b> (MTN, Moov) ou virement : acompte au démarrage, solde à la livraison.')]
    for i, (t, body) in enumerate(boxes):
        bx = m + i * (hw + 12)
        c.setFillColor(PANEL); c.setStrokeColor(LINE); c.roundRect(bx, y - bh2, hw, bh2, 9, stroke=1, fill=1)
        c.setFillColor(LIME); c.setFont('PB', 8); c.drawString(bx + 14, y - 20, t)
        para(c, body, bx + 14, y - 28, hw - 28, st('PL', 7.9, WHITE, 11.4))
    y -= bh2 + 22

    # CTA
    ch = 66
    assert y - ch > 30, f'débordement page 2: {y - ch}'
    c.setFillColor(LIME); c.roundRect(m, y - ch, cw, ch, 10, stroke=0, fill=1)
    c.setFillColor(INK); c.setFont('PB', 14); c.drawString(m + 20, y - 27, 'Parlons de votre projet.')
    c.setFont('PM', 8.6)
    c.drawString(m + 20, y - 45, 'WhatsApp  +229 01 48 13 53 95')
    c.drawString(m + 20, y - 58, MAIL)
    c.setFont('PB', 9); c.drawRightString(m + cw - 20, y - 27, 'calebcreative.online')
    c.setFont('PM', 8); c.drawRightString(m + cw - 20, y - 45, 'Boutique : calebcreative.online/boutique')
    link(c, WA, m, y - ch, cw / 2, ch)
    link(c, SITE, m + cw / 2, y - ch, cw / 2, ch)
    c.setFillColor(Color(1, 1, 1, .4)); c.setFont('PL', 7)
    c.drawString(m, 22, 'Caleb Jesugnon AGBAKOU — Book')
    c.drawRightString(W - m, 22, 'Page 2 / 2')
    c.showPage()

out = os.environ.get('OUT', './Caleb_AGBAKOU_CV_Book.pdf')
c = canvas.Canvas(out, pagesize=A4)
c.setTitle('Caleb Jesugnon AGBAKOU — CV & Book')
c.setAuthor('Caleb Jesugnon AGBAKOU'); c.setSubject('CV et book — Caleb Creative, créateur visuel au Bénin')
page_cv(c); page_book(c); c.save()
print('ok')