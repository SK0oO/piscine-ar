// Essai « télécommande dans la visionneuse Apple » (15/11/2026) : écrit demo/essai/essai-ra.usdz à la main.
// Une piscine simple (margelle + eau) entourée de boutons 3D posés au sol :
//   flèches orange = déplacer de 0,5 m, flèches bleues = tourner de 15°, carré vert = figer (cache les boutons),
//   carré rouge = libérer (les remet). Mécanique : « behaviors » Apple (TapGesture → Transform relatif, Visibility).
// But : savoir si Quick Look sur l'iPhone d'Alex exécute encore ces behaviors avant de les mettre dans les vraies piscines.
import { writeFileSync, mkdirSync } from 'node:fs';
import { crc32 } from 'node:zlib';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = resolve(fileURLToPath(import.meta.url), '../..');
const SORTIE = resolve(RACINE, 'demo/essai');

// ---- géométrie : prismes convexes (contour 2D en x, z extrudé en y) ----

const f = (n) => Number(n.toFixed(4));

// Faces orientées vers l'extérieur (sens trigonométrique vu de dehors), contrôlé par le produit vectoriel.
function prisme(contour, y0, y1) {
  const n = contour.length;
  const pts = [...contour.map(([x, z]) => [x, y0, z]), ...contour.map(([x, z]) => [x, y1, z])];
  const faces = [
    [...Array(n).keys()], // dessous
    [...Array(n).keys()].map((i) => n + i), // dessus
  ];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    faces.push([i, j, n + j, n + i]);
  }
  const centre = pts.reduce((c, p) => c.map((v, k) => v + p[k] / pts.length), [0, 0, 0]);
  const orientees = faces.map((face) => {
    const [a, b, c] = face.map((k) => pts[k]);
    const u = b.map((v, k) => v - a[k]);
    const w = c.map((v, k) => v - a[k]);
    const normale = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]];
    const milieu = face.reduce((m, k) => m.map((v, d) => v + pts[k][d] / face.length), [0, 0, 0]);
    const dehors = milieu.map((v, k) => v - centre[k]);
    const dot = normale[0] * dehors[0] + normale[1] * dehors[1] + normale[2] * dehors[2];
    return dot >= 0 ? face : [...face].reverse();
  });
  return { pts, faces: orientees };
}

const rectangle = (cx, cz, l, w) => [[cx - l / 2, cz - w / 2], [cx + l / 2, cz - w / 2], [cx + l / 2, cz + w / 2], [cx - l / 2, cz + w / 2]];

// Flèche (triangle) de pointe orientée selon l'angle a (0 = +x), taille t, centrée en (cx, cz).
function triangle(cx, cz, a, t) {
  const p = (r, b) => [cx + r * Math.cos(b), cz + r * Math.sin(b)];
  return [p(t * 0.6, a), p(t * 0.5, a + (2.3 * Math.PI) / 3), p(t * 0.5, a - (2.3 * Math.PI) / 3)];
}

function mesh(nom, { pts, faces }, materiau, indent) {
  const pad = '\t'.repeat(indent);
  return `${pad}def Mesh "${nom}" (
${pad}	prepend apiSchemas = ["MaterialBindingAPI"]
${pad})
${pad}{
${pad}	uniform bool doubleSided = 0
${pad}	int[] faceVertexCounts = [${faces.map((x) => x.length).join(', ')}]
${pad}	int[] faceVertexIndices = [${faces.flat().join(', ')}]
${pad}	point3f[] points = [${pts.map((p) => `(${p.map(f).join(', ')})`).join(', ')}]
${pad}	uniform token subdivisionScheme = "none"
${pad}	rel material:binding = </Racine/Materiaux/${materiau}>
${pad}}
`;
}

// ---- scène ----

const L = 8, W = 4, M = 0.3; // piscine 8 × 4 m, margelle 0,3 m
const T = 0.8; // taille d'un bouton au sol
const ecart = W / 2 + M + 0.9; // distance des boutons au bord
const haut = 0.06; // épaisseur des boutons

const boutons = {
  Loin: triangle(0, -ecart, -Math.PI / 2, T),
  Pres: triangle(0, ecart, Math.PI / 2, T),
  Gauche: triangle(-(L / 2 + M + 0.9), 0, Math.PI, T),
  Droite: triangle(L / 2 + M + 0.9, 0, 0, T),
  TournerG: triangle(-2.6, ecart, Math.PI, T * 0.8),
  TournerD: triangle(2.6, ecart, 0, T * 0.8),
};

// Déplacements relatifs (type "relative" : la cible donne un écart, pas une position).
const CIBLES = {
  Loin: 'double3 xformOp:translate = (0, 0, -0.5)',
  Pres: 'double3 xformOp:translate = (0, 0, 0.5)',
  Gauche: 'double3 xformOp:translate = (-0.5, 0, 0)',
  Droite: 'double3 xformOp:translate = (0.5, 0, 0)',
  TournerG: 'float xformOp:rotateY = 15',
  TournerD: 'float xformOp:rotateY = -15',
};
const OPS = { translate: 'uniform token[] xformOpOrder = ["xformOp:translate"]', rotate: 'uniform token[] xformOpOrder = ["xformOp:rotateY"]' };

const MATERIAUX = {
  Margelle: [0.86, 0.81, 0.73, 0.85],
  Eau: [0.2, 0.62, 0.82, 0.1],
  Orange: [1.0, 0.5, 0.0, 0.5],
  Bleu: [0.1, 0.45, 1.0, 0.5],
  Vert: [0.1, 0.75, 0.3, 0.5],
  Rouge: [0.9, 0.15, 0.15, 0.5],
};

function materiaux() {
  return Object.entries(MATERIAUX).map(([nom, [r, g, b, rough]]) => `		def Material "${nom}"
		{
			token outputs:surface.connect = </Racine/Materiaux/${nom}/Surface.outputs:surface>

			def Shader "Surface"
			{
				uniform token info:id = "UsdPreviewSurface"
				color3f inputs:diffuseColor = (${r}, ${g}, ${b})
				float inputs:metallic = 0
				float inputs:roughness = ${rough}
				token outputs:surface
			}
		}
`).join('\n');
}

const P = '/Racine/Scenes/Scene';

function tap(nom, objet, actions) {
	return `				def Preliminary_Behavior "${nom}"
				{
					rel triggers = <Tap>
					rel actions = <Actions>
					uniform bool exclusive = 0

					def Preliminary_Trigger "Tap"
					{
						rel affectedObjects = <${objet}>
						token info:id = "TapGesture"
					}

					def Preliminary_Action "Actions"
					{
						rel actions = [${actions.map((a) => `<${a.nom}>`).join(', ')}]
						token info:id = "Group"
						bool loops = 0
						int performCount = 1
						token type = "parallel"
${actions.map((a) => a.texte).join('\n')}
					}
				}
`;
}

const bouger = (nom, cible) => ({
  nom,
  texte: `						def Preliminary_Action "${nom}"
						{
							rel affectedObjects = <${P}/Piscine>
							double duration = 0.3
							token easeType = "inout"
							token info:id = "Transform"
							token type = "relative"
							rel xformTarget = <${P}/Cibles/${cible}>
						}`,
});

const visibilite = (nom, objet, montrer) => ({
  nom,
  texte: `						def Preliminary_Action "${nom}"
						{
							rel affectedObjects = <${objet}>
							double duration = 0.2
							token easeType = "none"
							token info:id = "Visibility"
							token motionType = "none"
							double moveDistance = 0
							token style = "basic"
							token type = "${montrer ? 'show' : 'hide'}"
						}`,
});

function scene() {
  const piscine = [
    mesh('Margelle', prisme(rectangle(0, 0, L + 2 * M, W + 2 * M), -0.05, 0), 'Margelle', 5),
    mesh('Eau', prisme(rectangle(0, 0, L, W), 0, 0.005), 'Eau', 5),
  ].join('');
  const commandes = Object.entries(boutons)
    .map(([nom, contour]) => mesh(nom, prisme(contour, 0.005, 0.005 + haut), nom.startsWith('Tourner') ? 'Bleu' : 'Orange', 6))
    .join('');
  const figer = mesh('Figer', prisme(rectangle(L / 2 + M + 0.9, ecart, T * 0.7, T * 0.7), 0.005, 0.005 + haut * 2), 'Vert', 6);
  const liberer = mesh('Liberer', prisme(rectangle(L / 2 + M + 0.9, ecart, T * 0.7, T * 0.7), 0.005, 0.005 + haut * 2), 'Rouge', 5);
  const cibles = Object.entries(CIBLES)
    .map(([nom, op]) => `				def Xform "${nom}"
				{
					${op}
					${op.includes('rotate') ? OPS.rotate : OPS.translate}
				}
`).join('');

  const C = `${P}/Piscine/Commandes`;
  const comportements = [
    ...Object.keys(CIBLES).map((nom) => tap(`Tap_${nom}`, `${C}/${nom}`, [bouger(`Bouger_${nom}`, nom)])),
    tap('Tap_Figer', `${C}/Figer`, [visibilite('Cacher_commandes', C, false), visibilite('Montrer_liberer', `${P}/Piscine/Liberer`, true)]),
    tap('Tap_Liberer', `${P}/Piscine/Liberer`, [visibilite('Montrer_commandes', C, true), visibilite('Cacher_liberer', `${P}/Piscine/Liberer`, false)]),
    // Au départ, « Libérer » est caché.
    `				def Preliminary_Behavior "Depart"
				{
					rel triggers = <Entree>
					rel actions = <Cacher>
					uniform bool exclusive = 0

					def Preliminary_Trigger "Entree"
					{
						token info:id = "SceneTransition"
						token type = "enter"
					}

${visibilite('Cacher', `${P}/Piscine/Liberer`, false).texte.replace(/^\t\t/gm, '')}
				}
`,
  ].join('\n');

  return `#usda 1.0
(
	customLayerData = {
		string creator = "piscine-ar essai behaviors"
	}
	defaultPrim = "Racine"
	metersPerUnit = 1
	upAxis = "Y"
)

def Xform "Racine"
{
	def Scope "Scenes" (
		kind = "sceneLibrary"
	)
	{
		def Xform "Scene" (
			apiSchemas = ["Preliminary_AnchoringAPI"]
			customData = {
				bool preliminary_collidesWithEnvironment = 0
				string sceneName = "Scene"
			}
			sceneName = "Scene"
		)
		{
			token preliminary:anchoring:type = "plane"
			token preliminary:planeAnchoring:alignment = "horizontal"

			def Xform "Piscine"
			{
${piscine}
				def Xform "Commandes"
				{
${commandes}${figer}				}

${liberer}			}

			def Scope "Cibles"
			{
${cibles}			}

			def Scope "Behaviors"
			{
${comportements}			}
		}
	}

	def Scope "Materiaux"
	{
${materiaux()}	}
}
`;
}

// ---- archive USDZ : zip sans compression, données alignées sur 64 octets ----

function usdz(fichiers) {
  const locaux = [];
  const central = [];
  let offset = 0;
  for (const [nom, donnees] of fichiers) {
    const nomB = Buffer.from(nom, 'utf8');
    const crc = crc32(donnees);
    const debut = offset + 30 + nomB.length;
    const pad = (64 - ((debut + 4) % 64)) % 64; // 4 octets d'en-tête de champ extra
    const extra = Buffer.alloc(4 + pad);
    extra.writeUInt16LE(0x1986, 0); // identifiant libre (padding)
    extra.writeUInt16LE(pad, 2);
    const entete = Buffer.alloc(30);
    entete.writeUInt32LE(0x04034b50, 0);
    entete.writeUInt16LE(20, 4);
    entete.writeUInt16LE(0, 6);
    entete.writeUInt16LE(0, 8); // stocké
    entete.writeUInt16LE(0, 10);
    entete.writeUInt16LE(0x21, 12);
    entete.writeUInt32LE(crc, 14);
    entete.writeUInt32LE(donnees.length, 18);
    entete.writeUInt32LE(donnees.length, 22);
    entete.writeUInt16LE(nomB.length, 26);
    entete.writeUInt16LE(extra.length, 28);
    locaux.push(entete, nomB, extra, donnees);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt16LE(0, 8);
    c.writeUInt16LE(0, 10);
    c.writeUInt16LE(0, 12);
    c.writeUInt16LE(0x21, 14);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(donnees.length, 20);
    c.writeUInt32LE(donnees.length, 24);
    c.writeUInt16LE(nomB.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(c, nomB);
    if ((offset + 30 + nomB.length + extra.length) % 64 !== 0) throw new Error('alignement');
    offset += 30 + nomB.length + extra.length + donnees.length;
  }
  const cd = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(cd.length, 12);
  fin.writeUInt32LE(offset, 16);
  return Buffer.concat([...locaux, cd, fin]);
}

mkdirSync(SORTIE, { recursive: true });
const usda = scene();
writeFileSync(resolve(SORTIE, 'essai-ra.usda'), usda);
writeFileSync(resolve(SORTIE, 'essai-ra.usdz'), usdz([['essai-ra.usda', Buffer.from(usda, 'utf8')]]));
console.log('demo/essai/essai-ra.usdz écrit');
