# Dashboard Layout Card V2

[English](README.md) | [Deutsch](README.de.md) | Français

Fork V2 installable en parallèle de [thomasloven/lovelace-layout-card](https://github.com/thomasloven/lovelace-layout-card), avec des fonctions supplémentaires pour créer des tableaux de bord Home Assistant.

Le projet original est sous licence MIT. Ce fork conserve l'attribution et enregistre ses propres éléments `*-v2`, afin de pouvoir être installé à côté de la `layout-card` originale sans la remplacer.

## Fonctionnalités

- Layouts V2 dédiés pour Masonry, Sections, Horizontal, Vertical et Grid.
- Menu latéral optionnel à gauche ou à droite pour naviguer entre les vues.
- Mode icônes uniquement automatique sur mobile et mode manuel pour les tableaux de bord kiosk/tablette.
- Sous-menu optionnel sous forme de colonne d'icônes pour l'entrée principale actuellement sélectionnée.
- Entrée Home, sous-vues et création de nouvelles sous-vues en Sections V2 par défaut.
- Héritage du thème depuis la vue Home.
- Horloge numérique ou analogique, date et jour de la semaine.
- Notification par helper texte et jusqu'à quatre valeurs d'état en lecture seule.
- Styles globaux, couleurs par bouton et jusqu'à 20 favoris de couleurs.
- Opacité réglable pour les bordures du menu, du contenu, des notifications, des états et des séparateurs.
- Export YAML du tableau de bord depuis l'onglet Backup.
- Sélecteur de langue Debug dans l'éditeur pour les captures d'écran de documentation.
- Masquage optionnel de la barre latérale et de l'en-tête Home Assistant pour certains utilisateurs.

## Installation

Ajoutez ce dépôt comme dépôt frontend personnalisé dans HACS :

```text
https://github.com/rockbaer2007/lovelace-layout-card-v2
```

Après l'installation, Home Assistant doit charger la ressource suivante :

```text
/hacsfiles/lovelace-layout-card-v2/dashboard-layout-card-v2.js
```

Si une ancienne version apparaît encore après la mise à jour, actualisez les dépôts HACS, videz le cache du navigateur et rechargez fortement le tableau de bord.

## Types enregistrés

Vues :

- `custom:sections-layout-v2`
- `custom:masonry-layout-v2`
- `custom:horizontal-layout-v2`
- `custom:vertical-layout-v2`
- `custom:grid-layout-v2`

Cartes et helpers :

- `custom:dashboard-layout-card-v2`
- `custom:layout-card-v2`
- `custom:layout-break-v2`
- `custom:gap-card-v2`

## Helpers nécessaires

Seules les fonctions activées nécessitent des helpers. Créez-les dans Home Assistant sous **Paramètres > Appareils et services > Helpers**.

| Entité | Type de helper | Utilisation | Obligatoire ? |
| --- | --- | --- | --- |
| `input_text.dashboard_notification` | Texte | Texte de notification optionnel. Vide, `unknown` et `unavailable` masquent la notification. | Seulement si `menu.notify.enabled` est utilisé. |
| `input_boolean.dashboard_holiday` | Interrupteur | Symbole du jour optionnel pour les jours fériés. | Seulement si le symbole doit réagir aux jours fériés. |
| `input_boolean.dashboard_birthday` | Interrupteur | Symbole du jour optionnel pour les anniversaires. | Seulement si le symbole doit réagir aux anniversaires. |
| `input_boolean.dashboard_christmas` | Interrupteur | Symbole du jour optionnel pour Avent/Noël. | Seulement si le symbole doit réagir à Avent/Noël. |

Les valeurs d'état n'ont pas besoin de helpers spéciaux. Elles peuvent utiliser toute entité Home Assistant lisible, par exemple des capteurs, binary sensors ou template sensors.

## Notification et valeurs d'état

Le bloc de notification optionnel apparaît au-dessus des valeurs d'état dans le menu latéral. Un helper texte comme `input_text.dashboard_notification` est recommandé. Tant que l'entité manque, est vide, `unknown` ou `unavailable`, la notification reste masquée.

Dès que le helper contient du texte, le message apparaît dans le menu, par exemple pour des pannes, rappels de maintenance ou messages courts du tableau de bord. En mode icônes uniquement, l'horloge, la date et les valeurs d'état sont masquées, mais les notifications restent disponibles via un bouton compact avec popup.

## Menu, sous-menus et couleurs

Jusqu'à 600 px de largeur d'écran, les boutons du menu affichent automatiquement seulement les icônes. Le mode icônes uniquement peut aussi être activé manuellement pour les tablettes kiosk ou les écrans muraux.

Chaque entrée principale peut avoir un sous-menu. Le sous-menu apparaît comme une colonne d'icônes à côté du menu principal et montre seulement les sous-pages de l'entrée actuellement sélectionnée. Le premier bouton du sous-menu peut ouvrir la page principale de cette entrée, ou être désactivé afin de passer directement à la première sous-page.

Les entrées Home, menu principal et sous-menu peuvent définir leurs propres couleurs : couleur d'icône, couleur d'icône active, arrière-plan d'icône, arrière-plan d'icône actif, couleur du bouton et couleur du bouton actif. Les champs vides utilisent le style global.

## Onglets de l'éditeur

| Onglet | Options |
| --- | --- |
| Menu | Position du menu, titre du menu et mode icônes uniquement global. |
| Home page | Entrée Home, titre, chemin, icône, couleurs Home, colonnes Sections V2 et héritage du thème. |
| Display | Horloge, date, jour de la semaine, couleurs de l'horloge et helpers pour le symbole du jour. |
| Pages | Pages principales, espaces, séparateurs, layouts, couleurs par entrée et comportement du premier bouton de sous-menu. |
| Submenu | Sous-pages de la page principale sélectionnée avec couleurs et layout. |
| Messages | Notification, bordures, opacité et jusqu'à quatre valeurs d'état. |
| Styles Global | Couleurs globales, tailles, formes d'icônes, arrière-plans, opacités et effets 3D. |
| Colors | Jusqu'à 20 couleurs favorites réutilisables. |
| Backup | Export YAML du tableau de bord actuel vers l'ordinateur local. |
| Advanced | Réglages Home Assistant chrome, utilisateurs visibles, Debug et JSON avancé. |

## Sélecteur de langue Debug

Pour les captures d'écran de documentation ou les tests de langue, l'éditeur propose **Advanced > Special options / edit JSON > Debug**. Le choix `Default` garde la détection automatique via Home Assistant ou le navigateur.

```yaml
debug:
  language: fr # vide/default, de, en ou fr
```

## Images d'arrière-plan

Les images de menu doivent être placées dans le dossier `www` de Home Assistant, par exemple :

```text
/config/www/image/back2.jpg
```

Dans l'éditeur, utilisez ensuite :

```text
/local/image/back2.jpg
```

Les images verticales fonctionnent le mieux pour un menu latéral. Un rapport pratique est environ `1:2,5` largeur:hauteur. Utilisez uniquement vos propres images ou des images avec une licence libre compatible.

## Statut

Ce fork V2 est actif et orienté vers les tableaux de bord Home Assistant. L'API peut encore évoluer pendant que les fonctions V2 sont affinées.

## Attribution

Basé sur [thomasloven/lovelace-layout-card](https://github.com/thomasloven/lovelace-layout-card), sous licence MIT.
