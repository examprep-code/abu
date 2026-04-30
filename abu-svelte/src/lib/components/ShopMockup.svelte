<script>
  import { formatSwissRecentDateTime } from '$lib/date';
  import { detectWorksheetContentTypes } from '$lib/worksheet-elements';

  export let sheets = [];
  export let collections = [];
  export let collectionLinks = [];
  export let loading = false;
  export let error = '';
  export let onOpenSheet = () => {};
  export let onPreviewSheet = () => {};

  const SHOP_SLOGAN = 'ABU-Sammlungen nach Schullehrplan, Sprache und Lernweg finden.';

  const SHOP_K_LEVELS = [
    {
      id: 'K1',
      label: 'K1 Verstehen',
      keywords: ['nennen', 'erkennen', 'beschreiben', 'verstehen', 'zentrale aussagen']
    },
    {
      id: 'K2',
      label: 'K2 Anwenden',
      keywords: ['anwenden', 'nutzen', 'planen', 'erstellen', 'einrichten', 'formulieren']
    },
    {
      id: 'K3',
      label: 'K3 Analysieren',
      keywords: ['analysieren', 'vergleichen', 'begründen', 'beurteilen', 'identifizieren']
    },
    {
      id: 'K4',
      label: 'K4 Entwickeln',
      keywords: ['entwickeln', 'reflektieren', 'gestalten', 'transfer', 'kritisch', 'lösen']
    }
  ];

  const LANGUAGE_MODES = [
    {
      id: 'rez-mdl',
      label: 'Rezeption mündlich',
      shortLabel: 'Rez. mündlich',
      keywords: ['hören', 'audio', 'podcast', 'interview', 'debatte', 'gespräch', 'mündlich']
    },
    {
      id: 'rez-av',
      label: 'Rezeption audiovisuell',
      shortLabel: 'Rez. AV',
      keywords: ['video', 'film', 'clip', 'dokumentation', 'werbung', 'audiovisuell']
    },
    {
      id: 'rez-schr',
      label: 'Rezeption schriftlich und bildlich',
      shortLabel: 'Rez. schriftlich',
      keywords: ['lesen', 'text', 'quelle', 'vertrag', 'gesetz', 'grafik', 'bildlich', 'website']
    },
    {
      id: 'prod-mdl',
      label: 'Produktion mündlich',
      shortLabel: 'Prod. mündlich',
      keywords: ['präsentieren', 'vortragen', 'statement', 'mündlich', 'rede', 'debattieren']
    },
    {
      id: 'prod-schr',
      label: 'Produktion schriftlich und bildlich',
      shortLabel: 'Prod. schriftlich',
      keywords: ['schreiben', 'kommentar', 'brief', 'text verfassen', 'factsheet', 'flyer']
    },
    {
      id: 'prod-mm',
      label: 'Produktion multimedial',
      shortLabel: 'Prod. multimedial',
      keywords: ['multimedia', 'präsentation', 'kurzvideo', 'video', 'social media', 'kampagne']
    },
    {
      id: 'ik-mdl',
      label: 'Interaktion und Kollaboration mündlich',
      shortLabel: 'I&K mündlich',
      keywords: ['diskussion', 'austausch', 'feedback', 'rückmeldung', 'gruppengespräch']
    },
    {
      id: 'ik-schr',
      label: 'Interaktion und Kollaboration schriftlich',
      shortLabel: 'I&K schriftlich',
      keywords: ['korrespondenz', 'rückmeldung verfassen', 'kooperativ', 'reklamation', 'mail']
    },
    {
      id: 'ik-dig',
      label: 'Interaktion und Kollaboration digital',
      shortLabel: 'I&K digital',
      keywords: ['ki', 'prompt', 'chat', 'digital', 'tool', 'online', 'kommunikationstechnologie']
    }
  ];

  const TEXT_BUILD_COMPETENCIES = [
    {
      id: 'argumentation',
      label: 'Argumentation',
      keywords: ['argument', 'begründen', 'standpunkt', 'überzeugen', 'debatt']
    },
    {
      id: 'erklärung',
      label: 'Erklärung',
      keywords: ['erklären', 'erklärung', 'zusammenhang', 'ursache', 'wirkung']
    },
    {
      id: 'beschreibung',
      label: 'Beschreibung',
      keywords: ['beschreiben', 'darstellen', 'situation', 'beobachtung', 'merkmal']
    },
    {
      id: 'analyse',
      label: 'Analyse',
      keywords: ['analysieren', 'untersuchen', 'einordnen', 'identifizieren', 'kritisch prüfen']
    },
    {
      id: 'vergleich',
      label: 'Vergleich',
      keywords: ['vergleichen', 'unterschied', 'gemeinsamkeit', 'kontrast', 'abwägen']
    },
    {
      id: 'stellungnahme',
      label: 'Stellungnahme und Kommentar',
      keywords: ['meinung', 'kommentar', 'stellungnahme', 'haltung', 'wertung']
    },
    {
      id: 'dokumentation',
      label: 'Bericht und Dokumentation',
      keywords: ['dokumentieren', 'bericht', 'protokoll', 'journal', 'festhalten']
    },
    {
      id: 'korrespondenz',
      label: 'Formale Korrespondenz',
      keywords: ['brief', 'mail', 'reklamation', 'anliegen', 'forderung', 'formal']
    },
    {
      id: 'dialog',
      label: 'Dialog und Gesprächsführung',
      keywords: ['gespräch', 'dialog', 'konflikt', 'zuhören', 'kommunizieren']
    },
    {
      id: 'präsentation',
      label: 'Präsentation',
      keywords: ['präsentation', 'vortrag', 'kampagne', 'flyer', 'factsheet', 'video']
    },
    {
      id: 'reflexion',
      label: 'Reflexion',
      keywords: ['reflektieren', 'selbst', 'werte', 'rückblick', 'einschätzen']
    },
    {
      id: 'instruktion',
      label: 'Instruktion und Prozess',
      keywords: ['anleitung', 'leitfaden', 'strategie', 'planung', 'schritte']
    }
  ];

  const CLASSIC_THEMES = [
    {
      id: 'lehre-arbeit',
      label: 'Lehre und Arbeit',
      keywords: ['lehre', 'ausbildung', 'beruf', 'arbeitswelt', 'betrieb', 'arbeitsvertrag']
    },
    {
      id: 'wohnen',
      label: 'Wohnen',
      keywords: ['wohnen', 'wohnung', 'miete', 'mietrecht', 'haushalt', 'zuhause']
    },
    {
      id: 'konsum',
      label: 'Konsum',
      keywords: ['konsum', 'einkaufen', 'kaufvertrag', 'produkt', 'werbung']
    },
    {
      id: 'geld-budget',
      label: 'Geld und Budget',
      keywords: ['budget', 'geld', 'lohn', 'schulden', 'finanzen', 'steuer']
    },
    {
      id: 'recht',
      label: 'Recht und Verträge',
      keywords: ['recht', 'vertrag', 'pflicht', 'anspruch', 'gesetz', 'forderung']
    },
    {
      id: 'politik',
      label: 'Politik und Staat',
      keywords: ['politik', 'staat', 'demokratie', 'wahl', 'abstimmung', 'partizipation']
    },
    {
      id: 'nachhaltigkeit',
      label: 'Nachhaltigkeit und Umwelt',
      keywords: ['nachhaltig', 'ökologie', 'umwelt', 'klima', 'ressourcen', 'energie']
    },
    {
      id: 'gesundheit',
      label: 'Gesundheit',
      keywords: ['gesundheit', 'wohlbefinden', 'belastung', 'psychisch', 'körperlich']
    },
    {
      id: 'vorsorge',
      label: 'Versicherungen und Vorsorge',
      keywords: ['versicherung', 'vorsorge', 'altersvorsorge', 'drei säulen', 'sozialversicherung']
    },
    {
      id: 'medien-digital',
      label: 'Medien und Digitalisierung',
      keywords: ['medien', 'digital', 'ki', 'algorithmus', 'fake news', 'robotik']
    },
    {
      id: 'identität',
      label: 'Zusammenleben und Identität',
      keywords: ['identität', 'zusammenleben', 'migration', 'vielfalt', 'diskriminierung']
    },
    {
      id: 'kultur',
      label: 'Kultur',
      keywords: ['kultur', 'kunst', 'musik', 'film', 'literatur', 'ausdrucksform']
    },
    {
      id: 'mobilität',
      label: 'Mobilität',
      keywords: ['mobilität', 'verkehr', 'reisen', 'öpnv', 'auto', 'alltag']
    },
    {
      id: 'erben-lebensplanung',
      label: 'Erben und Lebensplanung',
      keywords: ['erben', 'nachlass', 'testament', 'lebensplanung', 'lebensphase']
    }
  ];

  const SOCIETY_ASPECTS = [
    {
      id: 'ethik',
      label: 'Ethik',
      keywords: ['ethik', 'werte', 'moral', 'respekt', 'würde', 'verantwortung']
    },
    {
      id: 'identität-sozialisation',
      label: 'Identität und Sozialisation',
      keywords: ['identität', 'rolle', 'selbstbild', 'sozialisation', 'zugehörigkeit']
    },
    {
      id: 'kultur',
      label: 'Kultur',
      keywords: ['kultur', 'kunst', 'film', 'musik', 'literatur', 'ausdruck']
    },
    {
      id: 'ökologie',
      label: 'Ökologie',
      keywords: ['ökologie', 'umwelt', 'klima', 'ressource', 'energie', 'nachhaltig']
    },
    {
      id: 'politik',
      label: 'Politik',
      keywords: ['politik', 'demokratie', 'staat', 'menschenrechte', 'mitwirkung']
    },
    {
      id: 'recht',
      label: 'Recht',
      keywords: ['recht', 'vertrag', 'gesetz', 'pflicht', 'forderung', 'mietrecht']
    },
    {
      id: 'technologie',
      label: 'Technologie und digitale Transformation',
      keywords: ['technologie', 'digital', 'ki', 'algorithmus', 'robotik', 'tools']
    },
    {
      id: 'wirtschaft',
      label: 'Wirtschaft',
      keywords: ['wirtschaft', 'markt', 'preis', 'budget', 'lohn', 'unternehmen']
    }
  ];

  const KEY_COMPETENCIES = [
    'Quellen unterscheiden',
    'Ziele setzen und anpassen',
    'Innovation und Problemlösung',
    'Teamarbeit',
    'Werthaltungen reflektieren',
    'Standpunkte begründen',
    'Verständnis fördern',
    'Lebensphasen planen',
    'Nachhaltigkeit',
    'Anpassung',
    'Mehrdeutigkeit',
    'Partizipation'
  ];

  const CURRICULUM_THEMES = [
    {
      id: 't1',
      label: 'T1 Ins Berufsleben einsteigen',
      title: 'Ins Berufsleben einsteigen',
      year: '1. Lehrjahr',
      lessons: '21 Lektionen',
      status: 'ausgearbeitet',
      modes: ['rez-schr', 'ik-mdl', 'ik-dig'],
      aspects: ['recht', 'ethik', 'identität-sozialisation', 'technologie'],
      keyCompetencies: [
        'Ziele setzen und anpassen',
        'Teamarbeit',
        'Standpunkte begründen',
        'Lebensphasen planen'
      ],
      keywords: [
        'berufsleben',
        'ausbildung',
        'lehrvertrag',
        'betrieb',
        'lernstrategie',
        'arbeitszeit'
      ],
      subthemes: [
        {
          id: 't1-1-1',
          label: '1.1.1 Lehrvertrag, Quellen und Konfliktkommunikation',
          shortLabel: 'Lehrvertrag und Konfliktkommunikation',
          modes: ['rez-schr', 'ik-mdl'],
          aspects: ['recht', 'ethik', 'identität-sozialisation'],
          keyCompetencies: ['Standpunkte begründen', 'Teamarbeit'],
          keywords: ['lehrvertrag', 'rechte', 'pflichten', 'konflikt', 'kommunikation']
        },
        {
          id: 't1-1-2',
          label: '1.1.2 IT-Infrastruktur und digitale Werkzeuge',
          shortLabel: 'IT-Infrastruktur',
          modes: ['rez-schr', 'ik-dig'],
          aspects: ['technologie'],
          keyCompetencies: ['Ziele setzen und anpassen'],
          keywords: ['it', 'infrastruktur', 'tool', 'sicherheit', 'website']
        },
        {
          id: 't1-1-3',
          label: '1.1.3 Kommunikationstechnologien zielgruppengerecht einsetzen',
          shortLabel: 'Digitale Kommunikation',
          modes: ['ik-schr', 'ik-dig'],
          aspects: ['technologie'],
          keyCompetencies: ['Teamarbeit'],
          keywords: ['kommunikationstechnologie', 'digital', 'zielgruppe', 'konvention']
        },
        {
          id: 't1-2-1',
          label: '1.2.1 Lern- und Arbeitszeit planen',
          shortLabel: 'Lern- und Arbeitszeit',
          modes: ['ik-mdl', 'prod-schr'],
          aspects: ['technologie', 'identität-sozialisation'],
          keyCompetencies: ['Ziele setzen und anpassen', 'Lebensphasen planen'],
          keywords: ['lernzeit', 'arbeitszeit', 'planung', 'ressourcen']
        },
        {
          id: 't1-2-2',
          label: '1.2.2 Kompetenznachweis mit Lernstrategien und KI vorbereiten',
          shortLabel: 'Kompetenznachweis und KI',
          modes: ['rez-schr', 'ik-dig'],
          aspects: ['technologie', 'identität-sozialisation'],
          keyCompetencies: ['Ziele setzen und anpassen'],
          keywords: ['kompetenznachweis', 'lernstrategie', 'ki', 'prompt']
        }
      ]
    },
    {
      id: 't2',
      label: 'T2 Meinungen bilden und mitgestalten',
      title: 'Meinungen bilden und mitgestalten',
      year: '1. Lehrjahr',
      lessons: '30 Lektionen',
      status: 'ausgearbeitet',
      modes: ['rez-mdl', 'prod-mdl', 'prod-schr'],
      aspects: ['politik', 'ethik', 'kultur', 'technologie'],
      keyCompetencies: [
        'Quellen unterscheiden',
        'Werthaltungen reflektieren',
        'Standpunkte begründen',
        'Verständnis fördern',
        'Partizipation'
      ],
      keywords: [
        'meinung',
        'desinformation',
        'fake news',
        'diskriminierung',
        'menschenrechte',
        'politik'
      ],
      subthemes: [
        {
          id: 't2-1-1',
          label: '2.1.1 Politische Audio-Beiträge verstehen',
          shortLabel: 'Politische Beiträge hören',
          modes: ['rez-mdl', 'rez-av'],
          aspects: ['politik'],
          keyCompetencies: ['Quellen unterscheiden'],
          keywords: ['audio', 'debatte', 'interview', 'politische themen', 'interessen']
        },
        {
          id: 't2-1-2',
          label: '2.1.2 Manipulation, Filterblasen und Desinformation erkennen',
          shortLabel: 'Desinformation und Filterblasen',
          modes: ['rez-schr', 'prod-schr'],
          aspects: ['technologie', 'politik'],
          keyCompetencies: ['Quellen unterscheiden', 'Werthaltungen reflektieren'],
          keywords: ['manipulation', 'desinformation', 'fake news', 'filterblase', 'algorithmus']
        },
        {
          id: 't2-2-1',
          label: '2.2.1 Ausgrenzung, Diskriminierung und Meinungsfreiheit analysieren',
          shortLabel: 'Diskriminierung und Meinungsfreiheit',
          modes: ['rez-mdl', 'rez-av'],
          aspects: ['ethik', 'politik'],
          keyCompetencies: ['Werthaltungen reflektieren', 'Verständnis fördern'],
          keywords: ['ausgrenzung', 'diskriminierung', 'meinungsfreiheit', 'menschenrechte']
        },
        {
          id: 't2-2-2',
          label: '2.2.2 Perspektiven nachvollziehen und Standpunkte entwickeln',
          shortLabel: 'Perspektiven und Standpunkte',
          modes: ['prod-mdl', 'prod-schr', 'ik-mdl'],
          aspects: ['ethik', 'politik'],
          keyCompetencies: ['Standpunkte begründen', 'Verständnis fördern'],
          keywords: ['perspektive', 'standpunkt', 'kommentar', 'argumentation']
        },
        {
          id: 't2-2-3',
          label: '2.2.3 Kunst als Haltung erkennen und kommentieren',
          shortLabel: 'Kunst und Haltung',
          modes: ['prod-schr', 'rez-av'],
          aspects: ['kultur'],
          keyCompetencies: ['Werthaltungen reflektieren'],
          keywords: ['kunst', 'musik', 'film', 'literatur', 'haltung']
        },
        {
          id: 't2-3-1',
          label: '2.3.1 Politische Anliegen formulieren und Mitwirkung aufzeigen',
          shortLabel: 'Anliegen und Mitwirkung',
          modes: ['prod-schr', 'prod-mm'],
          aspects: ['politik'],
          keyCompetencies: ['Partizipation', 'Standpunkte begründen'],
          keywords: ['anliegen', 'mitwirkung', 'flyer', 'factsheet', 'kampagne']
        },
        {
          id: 't2-3-2',
          label: '2.3.2 Begründete Meinung in Diskussionen vertreten',
          shortLabel: 'Diskussion und Gruppenentscheid',
          modes: ['ik-mdl', 'prod-mdl'],
          aspects: ['ethik', 'politik'],
          keyCompetencies: ['Partizipation', 'Standpunkte begründen'],
          keywords: ['diskussion', 'meinung', 'respektvoll', 'gruppenentscheid']
        }
      ]
    },
    {
      id: 't3',
      label: 'T3 Bewusst konsumieren und handeln',
      title: 'Bewusst konsumieren und handeln',
      year: '1. Lehrjahr',
      lessons: '33 Lektionen',
      status: 'ausgearbeitet',
      modes: ['rez-av', 'prod-mm', 'ik-schr'],
      aspects: ['wirtschaft', 'ökologie', 'recht', 'ethik', 'identität-sozialisation'],
      keyCompetencies: [
        'Quellen unterscheiden',
        'Innovation und Problemlösung',
        'Werthaltungen reflektieren',
        'Nachhaltigkeit'
      ],
      keywords: ['konsum', 'budget', 'schulden', 'nachhaltigkeit', 'kaufvertrag', 'reklamation'],
      subthemes: [
        {
          id: 't3-1-1',
          label: '3.1.1 Bedürfnisse und Konsumeinflüsse beurteilen',
          shortLabel: 'Bedürfnisse und Konsum',
          modes: ['rez-av', 'prod-schr'],
          aspects: ['wirtschaft', 'identität-sozialisation'],
          keyCompetencies: ['Werthaltungen reflektieren'],
          keywords: ['bedürfnis', 'konsum', 'werbung', 'zugehörigkeit']
        },
        {
          id: 't3-1-2',
          label: '3.1.2 Budget planen und Risiken erkennen',
          shortLabel: 'Budget und Risiken',
          modes: ['rez-av', 'prod-schr'],
          aspects: ['wirtschaft'],
          keyCompetencies: ['Ziele setzen und anpassen'],
          keywords: ['budget', 'geld', 'risiko', 'lohn', 'finanz']
        },
        {
          id: 't3-1-3',
          label: '3.1.3 Verschuldung vermeiden und Konsum reflektieren',
          shortLabel: 'Schuldenprävention',
          modes: ['rez-av', 'prod-schr'],
          aspects: ['wirtschaft', 'ethik'],
          keyCompetencies: ['Werthaltungen reflektieren'],
          keywords: ['schulden', 'verschuldung', 'konsumverhalten', 'verantwortung']
        },
        {
          id: 't3-2-1',
          label: '3.2.1 Nachhaltiger Konsum und Ressourcen',
          shortLabel: 'Nachhaltiger Konsum',
          modes: ['prod-mm', 'rez-av'],
          aspects: ['ökologie', 'wirtschaft', 'identität-sozialisation'],
          keyCompetencies: ['Nachhaltigkeit', 'Innovation und Problemlösung'],
          keywords: ['nachhaltig', 'ressourcen', 'klima', 'energie', 'umwelt']
        },
        {
          id: 't3-2-2',
          label: '3.2.2 Produktwert, Herstellung und Marktmechanismen beurteilen',
          shortLabel: 'Produktwert und Markt',
          modes: ['ik-schr', 'prod-schr'],
          aspects: ['wirtschaft'],
          keyCompetencies: ['Innovation und Problemlösung', 'Nachhaltigkeit'],
          keywords: ['produktwert', 'herstellung', 'transport', 'angebot', 'nachfrage', 'preis']
        },
        {
          id: 't3-3-1',
          label: '3.3.1 Kaufverträge rechtlich beurteilen',
          shortLabel: 'Kaufvertrag',
          modes: ['rez-schr', 'prod-schr'],
          aspects: ['recht'],
          keyCompetencies: ['Quellen unterscheiden'],
          keywords: ['kaufvertrag', 'vertrag', 'garantie', 'rückgabe', 'recht']
        },
        {
          id: 't3-3-2',
          label: '3.3.2 Reklamation und Forderung zielgruppengerecht formulieren',
          shortLabel: 'Reklamation und Forderung',
          modes: ['ik-mdl', 'ik-schr'],
          aspects: ['recht'],
          keyCompetencies: ['Standpunkte begründen'],
          keywords: ['reklamation', 'forderung', 'formal', 'korrespondenz', 'konfliktgespräch']
        }
      ]
    },
    {
      id: 't4',
      label: 'T4 Verantwortung für mich und andere übernehmen',
      title: 'Verantwortung für mich und andere übernehmen',
      year: '2. Lehrjahr',
      lessons: 'Skizze',
      status: 'Skizze',
      modes: ['rez-schr', 'prod-schr', 'ik-mdl'],
      aspects: ['ethik', 'identität-sozialisation', 'kultur', 'recht'],
      keyCompetencies: ['Werthaltungen reflektieren', 'Verständnis fördern', 'Anpassung'],
      keywords: ['verantwortung', 'gesundheit', 'vielfalt', 'migration', 'chancengerechtigkeit'],
      subthemes: [
        {
          id: 't4-1',
          label: '4.1 Körperliches und psychisches Wohlbefinden',
          shortLabel: 'Wohlbefinden und Gesundheit',
          modes: ['rez-schr', 'prod-schr', 'ik-mdl'],
          aspects: ['ethik', 'identität-sozialisation', 'recht'],
          keyCompetencies: ['Werthaltungen reflektieren', 'Anpassung'],
          keywords: ['gesundheit', 'wohlbefinden', 'belastung', 'risiko']
        },
        {
          id: 't4-2',
          label: '4.2 Vielfalt anerkennen und respektvoll handeln',
          shortLabel: 'Vielfalt und Respekt',
          modes: ['ik-mdl', 'prod-schr'],
          aspects: ['ethik', 'identität-sozialisation', 'kultur'],
          keyCompetencies: ['Verständnis fördern', 'Werthaltungen reflektieren'],
          keywords: ['vielfalt', 'respekt', 'vorurteil', 'rollen']
        },
        {
          id: 't4-3',
          label: '4.3 Integration, Migration und Chancengerechtigkeit',
          shortLabel: 'Migration und Chancengerechtigkeit',
          modes: ['rez-schr', 'prod-schr', 'ik-mdl'],
          aspects: ['kultur', 'ethik', 'recht'],
          keyCompetencies: ['Mehrdeutigkeit', 'Verständnis fördern'],
          keywords: ['migration', 'integration', 'ausgrenzung', 'chancengerechtigkeit']
        }
      ]
    },
    {
      id: 't5',
      label: 'T5 Mich im Staat orientieren und Gesellschaft mitgestalten',
      title: 'Mich im Staat orientieren und Gesellschaft mitgestalten',
      year: '2. Lehrjahr',
      lessons: 'Skizze',
      status: 'Skizze',
      modes: ['rez-av', 'prod-mdl', 'ik-dig'],
      aspects: ['politik', 'recht', 'wirtschaft', 'ökologie'],
      keyCompetencies: ['Partizipation', 'Ziele setzen und anpassen', 'Nachhaltigkeit'],
      keywords: ['staat', 'steuer', 'vorsorge', 'demokratie', 'mitgestaltung'],
      subthemes: [
        {
          id: 't5-1',
          label: '5.1 Finanzielle Selbstständigkeit, Steuern und Vorsorge',
          shortLabel: 'Steuern und Vorsorge',
          modes: ['rez-schr', 'prod-schr'],
          aspects: ['wirtschaft', 'recht'],
          keyCompetencies: ['Ziele setzen und anpassen', 'Lebensphasen planen'],
          keywords: ['steuer', 'vorsorge', 'versicherung', 'geldanlage', 'krypto']
        },
        {
          id: 't5-2',
          label: '5.2 Rechte, Pflichten und politische Mitgestaltung',
          shortLabel: 'Mitgestaltung und Rechte',
          modes: ['prod-mdl', 'ik-dig', 'prod-schr'],
          aspects: ['politik', 'recht'],
          keyCompetencies: ['Partizipation', 'Standpunkte begründen'],
          keywords: ['wahl', 'abstimmung', 'petition', 'mitbestimmen', 'rechte']
        },
        {
          id: 't5-3',
          label: '5.3 Staatsaufgaben, Umwelt und digitale Öffentlichkeit',
          shortLabel: 'Staatsaufgaben',
          modes: ['rez-av', 'ik-dig', 'prod-mdl'],
          aspects: ['politik', 'ökologie', 'technologie'],
          keyCompetencies: ['Nachhaltigkeit', 'Mehrdeutigkeit'],
          keywords: ['staatsaufgaben', 'demokratie', 'umwelt', 'digitalisierung', 'tonalität']
        }
      ]
    },
    {
      id: 't6',
      label: 'T6 Mein eigenes Zuhause',
      title: 'Mein eigenes Zuhause',
      year: '2. Lehrjahr',
      lessons: 'Skizze',
      status: 'Skizze',
      modes: ['rez-mdl', 'prod-mm', 'ik-schr'],
      aspects: ['identität-sozialisation', 'recht', 'ökologie', 'wirtschaft'],
      keyCompetencies: [
        'Innovation und Problemlösung',
        'Teamarbeit',
        'Lebensphasen planen',
        'Nachhaltigkeit'
      ],
      keywords: ['zuhause', 'wohnung', 'miete', 'mobilität', 'wohngemeinschaft'],
      subthemes: [
        {
          id: 't6-1',
          label: '6.1 Wohnung finden und Einzug organisieren',
          shortLabel: 'Wohnung und Einzug',
          modes: ['rez-schr', 'prod-schr'],
          aspects: ['wirtschaft', 'identität-sozialisation'],
          keyCompetencies: ['Lebensphasen planen', 'Innovation und Problemlösung'],
          keywords: ['wohnung', 'einzug', 'budget', 'bedürfnisse']
        },
        {
          id: 't6-2',
          label: '6.2 Mietrecht, Versicherungen und Korrespondenz',
          shortLabel: 'Mietrecht und Versicherung',
          modes: ['rez-mdl', 'ik-schr'],
          aspects: ['recht', 'wirtschaft'],
          keyCompetencies: ['Quellen unterscheiden'],
          keywords: ['mietrecht', 'versicherung', 'vermieter', 'schlichtung', 'korrespondenz']
        },
        {
          id: 't6-3',
          label: '6.3 Wohn- und Lebensformen respektvoll gestalten',
          shortLabel: 'Wohnformen',
          modes: ['ik-mdl', 'prod-schr'],
          aspects: ['identität-sozialisation', 'ethik'],
          keyCompetencies: ['Teamarbeit', 'Verständnis fördern'],
          keywords: ['wohnform', 'wg', 'zusammenleben', 'partner', 'werte']
        },
        {
          id: 't6-4',
          label: '6.4 Mobilität und ressourcenschonender Alltag',
          shortLabel: 'Mobilität und Ressourcen',
          modes: ['prod-mm', 'rez-av'],
          aspects: ['ökologie', 'recht', 'wirtschaft'],
          keyCompetencies: ['Nachhaltigkeit'],
          keywords: ['mobilität', 'strom', 'wasser', 'müll', 'ressourcen']
        }
      ]
    },
    {
      id: 't7',
      label: 'T7 Arbeiten in der Zukunft',
      title: 'Arbeiten in der Zukunft',
      year: '3. Lehrjahr',
      lessons: 'Skizze',
      status: 'Skizze',
      modes: ['rez-schr', 'prod-mm', 'ik-schr'],
      aspects: ['technologie', 'identität-sozialisation', 'recht', 'wirtschaft'],
      keyCompetencies: ['Innovation und Problemlösung', 'Teamarbeit', 'Lebensphasen planen'],
      keywords: ['zukunft', 'arbeitswelt', 'robotik', 'ki', 'laufbahn', 'arbeitsrecht'],
      subthemes: [
        {
          id: 't7-1',
          label: '7.1 Digitalisierung, Robotik und KI in der Arbeitswelt',
          shortLabel: 'Digitalisierung und KI',
          modes: ['rez-schr', 'prod-mm'],
          aspects: ['technologie', 'wirtschaft'],
          keyCompetencies: ['Innovation und Problemlösung', 'Anpassung'],
          keywords: ['digitalisierung', 'robotik', 'ki', 'branche', 'berufsbild']
        },
        {
          id: 't7-2',
          label: '7.2 Laufbahn, Weiterbildung und Lebensqualität planen',
          shortLabel: 'Laufbahn und Lebensqualität',
          modes: ['prod-schr', 'prod-mm'],
          aspects: ['identität-sozialisation', 'wirtschaft'],
          keyCompetencies: ['Lebensphasen planen', 'Ziele setzen und anpassen'],
          keywords: ['laufbahn', 'weiterbildung', 'stärken', 'work-life-balance', 'ziele']
        },
        {
          id: 't7-3',
          label: '7.3 Arbeitsrecht, Sozialversicherungen und Wandel',
          shortLabel: 'Arbeitsrecht und Vorsorge',
          modes: ['rez-schr', 'ik-schr'],
          aspects: ['recht', 'wirtschaft'],
          keyCompetencies: ['Quellen unterscheiden', 'Anpassung'],
          keywords: ['arbeitsvertrag', 'kündigung', 'sozialversicherung', 'vorsorge', 'rechte']
        }
      ]
    }
  ];

  const SHOP_COLLECTION_PRICES = [19, 29, 39, 59, 79];
  const SHOP_SCHOOL_PRICES = [129, 189, 249, 329];
  const SHOP_SORT_OPTIONS = [
    { value: 'featured', label: 'Lehrplan-Passung' },
    { value: 'updated', label: 'Neu aktualisiert' },
    { value: 'price_low', label: 'Preis aufsteigend' },
    { value: 'scope', label: 'Umfang zuerst' },
    { value: 'alpha', label: 'A bis Z' }
  ];
  const LICENSE_OPTIONS = [
    { id: 'free', label: 'Gratis' },
    { id: 'collection', label: 'Sammlungslizenz' },
    { id: 'school', label: 'Schullizenz' }
  ];
  const AI_SEARCH_STOP_WORDS = new Set([
    'aber',
    'alle',
    'als',
    'auch',
    'auf',
    'aus',
    'bei',
    'das',
    'dem',
    'den',
    'der',
    'die',
    'ein',
    'eine',
    'einen',
    'einer',
    'etwas',
    'für',
    'ich',
    'im',
    'in',
    'mit',
    'nach',
    'oder',
    'soll',
    'suche',
    'und',
    'von',
    'was',
    'zu',
    'zum',
    'zur'
  ]);
  const chfFormatter = new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    maximumFractionDigits: 0
  });

  const allSubthemes = CURRICULUM_THEMES.flatMap((theme) =>
    theme.subthemes.map((subtheme) => ({
      ...subtheme,
      themeId: theme.id,
      themeLabel: theme.label
    }))
  );

  const optionMaps = {
    modes: new Map(LANGUAGE_MODES.map((entry) => [entry.id, entry])),
    k: new Map(SHOP_K_LEVELS.map((entry) => [entry.id, entry])),
    textBuild: new Map(TEXT_BUILD_COMPETENCIES.map((entry) => [entry.id, entry])),
    classic: new Map(CLASSIC_THEMES.map((entry) => [entry.id, entry])),
    aspects: new Map(SOCIETY_ASPECTS.map((entry) => [entry.id, entry])),
    licenses: new Map(LICENSE_OPTIONS.map((entry) => [entry.id, entry])),
    themes: new Map(CURRICULUM_THEMES.map((entry) => [entry.id, entry])),
    subthemes: new Map(allSubthemes.map((entry) => [entry.id, entry]))
  };

  let shopSearch = '';
  let aiSearchInput = '';
  let aiSearchQuery = '';
  let selectedKLevels = [];
  let selectedModes = [];
  let selectedTextBuilds = [];
  let selectedClassicThemes = [];
  let selectedCurriculumThemes = [];
  let selectedSubthemes = [];
  let selectedSocietyAspects = [];
  let selectedLicenses = [];
  let sortBy = 'featured';
  let multiSheetOnly = false;

  const stripHtml = (input = '') =>
    String(input)
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;|&#160;/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const normalizeText = (input = '') =>
    stripHtml(input)
      .toLowerCase()
      .replace(/\u00e4/g, 'ae')
      .replace(/\u00f6/g, 'oe')
      .replace(/\u00fc/g, 'ue')
      .replace(/\u00df/g, 'ss')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const hashString = (input = '') => {
    let hash = 0;
    const value = String(input);
    for (let index = 0; index < value.length; index += 1) {
      hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
    }
    return hash;
  };

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  const unique = (values = []) => {
    const seen = new Set();
    const result = [];
    values.forEach((value) => {
      if (!value || seen.has(value)) return;
      seen.add(value);
      result.push(value);
    });
    return result;
  };

  const sortLabel = (a, b) =>
    String(a?.label ?? a).localeCompare(String(b?.label ?? b), undefined, {
      numeric: true,
      sensitivity: 'base'
    });

  const countMatches = (input = '', pattern) => {
    const matches = String(input).match(pattern);
    return matches ? matches.length : 0;
  };

  const formatDate = (value = '') => (value ? formatSwissRecentDateTime(value) : 'ohne Datum');

  const formatDuration = (minutes = 0) => {
    const rounded = clamp(Math.round(minutes / 15) * 15, 30, 360);
    if (rounded >= 180) return `${Math.round(rounded / 60)}-${Math.round(rounded / 60) + 1} h`;
    return `${rounded}-${rounded + 15} min`;
  };

  const formatPriceLabel = (mode = 'free', price = 0) => {
    if (mode === 'free') return 'Gratis';
    if (mode === 'school') return `ab ${chfFormatter.format(price)}/Jahr`;
    return chfFormatter.format(price);
  };

  const shortList = (values = [], max = 3, empty = 'Nicht indexiert') => {
    const compact = values.filter(Boolean);
    if (!compact.length) return empty;
    const visible = compact.slice(0, max);
    const suffix = compact.length > max ? ` +${compact.length - max}` : '';
    return `${visible.join(', ')}${suffix}`;
  };

  const toggleFilterValue = (values = [], value = '') =>
    values.includes(value)
      ? values.filter((entry) => entry !== value)
      : [...values, value];

  const includesAll = (sourceIds = [], selectedIds = []) =>
    selectedIds.every((id) => sourceIds.includes(id));

  const getOptionLabel = (id = '', optionMap = new Map()) =>
    optionMap.get(id)?.shortLabel ?? optionMap.get(id)?.label ?? id;

  const getSelectedLabels = (ids = [], optionMap = new Map()) =>
    ids.map((id) => getOptionLabel(id, optionMap));

  const formatMultiFilterLabel = (ids = [], emptyLabel = 'Alle', optionMap = new Map()) =>
    ids.length ? shortList(getSelectedLabels(ids, optionMap), 2) : emptyLabel;

  const tokenizeAiSearch = (input = '') =>
    normalizeText(input)
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 2 && !AI_SEARCH_STOP_WORDS.has(token));

  const addUniqueRequirement = (requirements = [], requirement = {}) => {
    if (!requirement?.id || requirements.some((entry) => entry.id === requirement.id)) {
      return requirements;
    }
    return [...requirements, requirement];
  };

  const getScoredOptions = (query = '', options = []) =>
    options
      .map((option) => ({
        option,
        score: scoreOption(query, option)
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || sortLabel(a.option, b.option))
      .map((entry) => entry.option);

  const buildAiModeRequirements = (query = '') => {
    let requirements = [];
    if (query.includes('rezeption') || query.includes('reception')) {
      requirements = addUniqueRequirement(requirements, {
        id: 'req-rezeption',
        label: 'Rezeption',
        ids: LANGUAGE_MODES.filter((mode) => mode.id.startsWith('rez-')).map((mode) => mode.id)
      });
    }
    if (query.includes('produktion') || query.includes('sprachproduktion')) {
      requirements = addUniqueRequirement(requirements, {
        id: 'req-produktion',
        label: 'Produktion',
        ids: LANGUAGE_MODES.filter((mode) => mode.id.startsWith('prod-')).map((mode) => mode.id)
      });
    }
    if (query.includes('interaktion') || query.includes('kollaboration')) {
      requirements = addUniqueRequirement(requirements, {
        id: 'req-interaktion',
        label: 'Interaktion und Kollaboration',
        ids: LANGUAGE_MODES.filter((mode) => mode.id.startsWith('ik-')).map((mode) => mode.id)
      });
    }

    getScoredOptions(query, LANGUAGE_MODES).forEach((mode) => {
      requirements = addUniqueRequirement(requirements, {
        id: mode.id,
        label: mode.shortLabel,
        ids: [mode.id]
      });
    });
    return requirements;
  };

  const buildAiSearchContext = (query = '') => {
    const normalized = normalizeText(query);
    return {
      raw: query.trim(),
      normalized,
      tokens: unique(tokenizeAiSearch(query)),
      modeRequirements: buildAiModeRequirements(normalized),
      kLevels: getScoredOptions(normalized, SHOP_K_LEVELS),
      textBuild: getScoredOptions(normalized, TEXT_BUILD_COMPETENCIES),
      classicThemes: getScoredOptions(normalized, CLASSIC_THEMES),
      curriculumThemes: getScoredOptions(normalized, CURRICULUM_THEMES),
      subthemes: getScoredOptions(normalized, allSubthemes),
      societyAspects: getScoredOptions(normalized, SOCIETY_ASPECTS),
      licenses: getScoredOptions(normalized, LICENSE_OPTIONS)
    };
  };

  const scoreAiSearchResult = (entry = {}, context = {}) => {
    if (!context?.normalized) return null;

    const titleText = normalizeText(entry.title ?? '');
    const summaryText = normalizeText(entry.summary ?? '');
    const combinedText = `${entry.searchIndex ?? ''} ${summaryText}`;
    let score = 0;
    const reasons = [];

    context.tokens.forEach((token) => {
      if (titleText.includes(token)) {
        score += 9;
      } else if (combinedText.includes(token)) {
        score += 4;
      }
    });

    context.modeRequirements.forEach((requirement) => {
      const hasMode = requirement.ids.some((id) => entry.languageModeIds.includes(id));
      if (hasMode) {
        score += 18;
        reasons.push(requirement.label);
      } else {
        score -= 5;
      }
    });

    context.kLevels.forEach((level) => {
      if (entry.kLevelIds.includes(level.id)) {
        score += 10;
        reasons.push(level.id);
      }
    });
    context.textBuild.forEach((competency) => {
      if (entry.textBuildIds.includes(competency.id)) {
        score += 14;
        reasons.push(competency.label);
      }
    });
    context.classicThemes.forEach((theme) => {
      if (entry.classicThemeIds.includes(theme.id)) {
        score += 14;
        reasons.push(theme.label);
      }
    });
    context.curriculumThemes.forEach((theme) => {
      if (entry.curriculumThemeIds.includes(theme.id)) {
        score += 16;
        reasons.push(theme.label);
      }
    });
    context.subthemes.forEach((subtheme) => {
      if (entry.subthemeIds.includes(subtheme.id)) {
        score += 20;
        reasons.push(subtheme.shortLabel);
      }
    });
    context.societyAspects.forEach((aspect) => {
      if (entry.societyAspectIds.includes(aspect.id)) {
        score += 10;
        reasons.push(aspect.label);
      }
    });
    context.licenses.forEach((license) => {
      if (entry.priceMode === license.id) {
        score += 6;
        reasons.push(license.label);
      }
    });

    score += Math.min(18, Math.round((entry.featuredScore ?? 0) / 12));
    if (score <= 0) return null;

    return {
      item: entry,
      score,
      reasons: unique(reasons).slice(0, 5)
    };
  };

  const buildAiSearchResults = (catalog = [], context = {}) =>
    catalog
      .map((entry) => scoreAiSearchResult(entry, context))
      .filter(Boolean)
      .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
      .slice(0, 5);

  const runAiSearch = () => {
    aiSearchQuery = aiSearchInput.trim();
  };

  const resetAiSearch = () => {
    aiSearchInput = '';
    aiSearchQuery = '';
  };

  const buildEmptyFilterSummary = () => {
    const parts = [
      selectedCurriculumThemes.length
        ? shortList(getSelectedLabels(selectedCurriculumThemes, optionMaps.themes), 2)
        : '',
      selectedSubthemes.length
        ? shortList(getSelectedLabels(selectedSubthemes, optionMaps.subthemes), 2)
        : '',
      selectedModes.length
        ? shortList(getSelectedLabels(selectedModes, optionMaps.modes), 2)
        : '',
      selectedTextBuilds.length
        ? shortList(getSelectedLabels(selectedTextBuilds, optionMaps.textBuild), 2)
        : '',
      selectedKLevels.length ? selectedKLevels.join(', ') : ''
    ].filter(Boolean);

    return parts.length ? parts.join(' / ') : 'keine aktiven Mehrfachfilter';
  };

  const scoreKeywords = (text = '', keywords = []) =>
    keywords.reduce((score, keyword, index) => {
      const normalized = normalizeText(keyword);
      if (!normalized) return score;
      return text.includes(normalized) ? score + Math.max(1, 4 - Math.floor(index / 3)) : score;
    }, 0);

  const scoreOption = (text = '', option = {}) =>
    scoreKeywords(text, [
      option.label,
      option.title,
      option.shortLabel,
      ...(option.keywords ?? [])
    ]);

  const pickByScore = ({
    options = [],
    text = '',
    seed = 0,
    minCount = 1,
    maxCount = 3,
    preferredIds = []
  }) => {
    const scored = options
      .map((option) => ({
        option,
        score:
          scoreOption(text, option) +
          (preferredIds.includes(option.id) ? 6 : 0)
      }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || sortLabel(a.option, b.option))
      .map((entry) => entry.option);

    const result = [];
    scored.forEach((option) => {
      if (result.length < maxCount && !result.some((entry) => entry.id === option.id)) {
        result.push(option);
      }
    });

    const fallback = options.length
      ? [...options].sort((a, b) => {
          const seedA = hashString(`${seed}:${a.id}`);
          const seedB = hashString(`${seed}:${b.id}`);
          return seedA - seedB;
        })
      : [];

    fallback.forEach((option) => {
      if (result.length >= Math.min(maxCount, options.length)) return;
      if (!result.some((entry) => entry.id === option.id)) result.push(option);
    });

    return result.slice(0, clamp(Math.max(minCount, result.length), minCount, maxCount));
  };

  const detectSheetFormat = (content = '') => {
    const types = detectWorksheetContentTypes(content).map((type) => type.shortLabel);
    if (!types.length) return stripHtml(content) ? 'Arbeitsblatt' : 'Entwurf';
    if (types.length > 1) return 'Mixed';
    return types[0];
  };

  const getSheetLookupKey = (user, key) => `${user ?? ''}:${String(key ?? '')}`;

  const getLatestTimestamp = (values = []) => {
    const stamps = values
      .map((value) => {
        const stamp = value ? new Date(value).getTime() : Number.NaN;
        return Number.isNaN(stamp) ? 0 : stamp;
      })
      .filter(Boolean);
    return stamps.length ? Math.max(...stamps) : 0;
  };

  const getSheetSignals = (sheet = {}) => {
    const content = sheet?.content ?? '';
    const plainText = stripHtml(content);
    const lueckeCount = countMatches(content, /name="luecke\d+"/gi);
    const textdokumentCount = countMatches(content, /<\s*textdokument-feld\b/gi);
    const freitextCount = countMatches(content, /freitext/gi);
    const umfrageCount = countMatches(content, /umfrage/gi);
    const interactionCount = lueckeCount + textdokumentCount + freitextCount + umfrageCount;
    const moduleCount = clamp(
      Math.max(1, Math.ceil(plainText.length / 420)) + Math.ceil(interactionCount / 4),
      1,
      10
    );

    return {
      plainText,
      format: detectSheetFormat(content),
      interactionCount,
      moduleCount,
      durationMinutes: 12 + moduleCount * 9 + interactionCount * 3
    };
  };

  const inferCurriculum = (text = '', seed = 0) => {
    const themeScores = CURRICULUM_THEMES.map((theme) => {
      const subthemeScore = theme.subthemes.reduce(
        (sum, subtheme) => sum + scoreOption(text, subtheme),
        0
      );
      return {
        theme,
        score: scoreOption(text, theme) + subthemeScore
      };
    }).sort((a, b) => b.score - a.score || sortLabel(a.theme, b.theme));

    const topThemes = themeScores.filter((entry) => entry.score > 0).slice(0, 2).map((entry) => entry.theme);
    if (!topThemes.length) {
      topThemes.push(CURRICULUM_THEMES[seed % CURRICULUM_THEMES.length]);
    }

    const subthemeCandidates = topThemes.flatMap((theme) =>
      theme.subthemes.map((subtheme) => ({
        subtheme,
        score: scoreOption(text, subtheme) + scoreOption(text, theme)
      }))
    );
    const scoredSubthemes = subthemeCandidates
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || sortLabel(a.subtheme, b.subtheme))
      .map((entry) => entry.subtheme);

    const subthemes = [];
    scoredSubthemes.forEach((subtheme) => {
      if (subthemes.length < 5 && !subthemes.some((entry) => entry.id === subtheme.id)) {
        subthemes.push(subtheme);
      }
    });
    topThemes.forEach((theme) => {
      theme.subthemes.forEach((subtheme) => {
        if (subthemes.length >= 4) return;
        if (!subthemes.some((entry) => entry.id === subtheme.id)) subthemes.push(subtheme);
      });
    });

    return {
      themes: topThemes,
      subthemes: subthemes.slice(0, clamp(subthemes.length, 2, 5))
    };
  };

  const inferMetadata = (text = '', seed = 0, curriculum = { themes: [], subthemes: [] }) => {
    const preferredModeIds = unique([
      ...curriculum.themes.flatMap((theme) => theme.modes ?? []),
      ...curriculum.subthemes.flatMap((subtheme) => subtheme.modes ?? [])
    ]);
    const preferredAspectIds = unique([
      ...curriculum.themes.flatMap((theme) => theme.aspects ?? []),
      ...curriculum.subthemes.flatMap((subtheme) => subtheme.aspects ?? [])
    ]);
    const keyCompetencies = unique([
      ...curriculum.themes.flatMap((theme) => theme.keyCompetencies ?? []),
      ...curriculum.subthemes.flatMap((subtheme) => subtheme.keyCompetencies ?? [])
    ]);

    const kLevels = pickByScore({
      options: SHOP_K_LEVELS,
      text,
      seed,
      minCount: 2,
      maxCount: 4
    });
    const languageModes = pickByScore({
      options: LANGUAGE_MODES,
      text,
      seed,
      minCount: 2,
      maxCount: 5,
      preferredIds: preferredModeIds
    });
    const textBuild = pickByScore({
      options: TEXT_BUILD_COMPETENCIES,
      text,
      seed,
      minCount: 2,
      maxCount: 4
    });
    const classicThemes = pickByScore({
      options: CLASSIC_THEMES,
      text,
      seed,
      minCount: 2,
      maxCount: 4
    });
    const societyAspects = pickByScore({
      options: SOCIETY_ASPECTS,
      text,
      seed,
      minCount: 2,
      maxCount: 4,
      preferredIds: preferredAspectIds
    });

    return {
      kLevels,
      languageModes,
      textBuild,
      classicThemes,
      societyAspects,
      keyCompetencies: keyCompetencies.length
        ? keyCompetencies.slice(0, 5)
        : KEY_COMPETENCIES.slice(seed % 4, seed % 4 + 3)
    };
  };

  const buildSummary = (collection = {}, linkedSheets = []) => {
    const description = stripHtml(collection?.description ?? '');
    if (description) return description.slice(0, 230);

    const source = linkedSheets
      .map((sheet) => stripHtml(sheet?.content ?? ''))
      .find((content) => content.length > 32);
    if (source) return source.slice(0, 230);

    return 'Sammlung aus vorhandenen ABU-Sheets, nach Schullehrplan, Sprachmodi und Textaufbau indexiert.';
  };

  const buildShopCollection = (collection = {}, linkedSheets = [], index = 0, links = []) => {
    const sourceParts = [
      collection?.name,
      collection?.description,
      ...linkedSheets.flatMap((sheet) => [sheet?.name, sheet?.key, sheet?.content])
    ];
    const sourceText = normalizeText(sourceParts.filter(Boolean).join(' '));
    const seed = hashString(
      `${collection?.id ?? index}|${collection?.name ?? ''}|${linkedSheets
        .map((sheet) => sheet?.key ?? sheet?.id ?? '')
        .join('|')}`
    );
    const sheetSignals = linkedSheets.map(getSheetSignals);
    const curriculum = inferCurriculum(sourceText, seed);
    const metadata = inferMetadata(sourceText, seed, curriculum);
    const sheetCount = linkedSheets.length || links.length || 0;
    const moduleCount = Math.max(
      1,
      sheetSignals.reduce((sum, signal) => sum + signal.moduleCount, 0) || sheetCount || 1
    );
    const interactionCount = sheetSignals.reduce((sum, signal) => sum + signal.interactionCount, 0);
    const durationMinutes =
      sheetSignals.reduce((sum, signal) => sum + signal.durationMinutes, 0) ||
      moduleCount * 25;
    const formats = unique(sheetSignals.map((signal) => signal.format)).filter(Boolean);
    const priceMode =
      seed % 7 === 0 ? 'free' : seed % 3 === 0 || sheetCount >= 6 ? 'school' : 'collection';
    const price =
      priceMode === 'collection'
        ? SHOP_COLLECTION_PRICES[seed % SHOP_COLLECTION_PRICES.length]
        : priceMode === 'school'
        ? SHOP_SCHOOL_PRICES[seed % SHOP_SCHOOL_PRICES.length]
        : 0;
    const latestStamp = getLatestTimestamp([
      collection?.updated_at,
      collection?.created_at,
      ...linkedSheets.flatMap((sheet) => [sheet?.updated_at, sheet?.created_at])
    ]);
    const updatedRaw = latestStamp ? new Date(latestStamp).toISOString() : '';
    const primarySheet = linkedSheets[0] ?? null;
    const featuredScore =
      metadata.languageModes.length * 7 +
      curriculum.subthemes.length * 8 +
      metadata.societyAspects.length * 4 +
      moduleCount * 2 +
      interactionCount * 3 +
      (latestStamp ? Math.round(latestStamp / 10000000000) : 0);

    return {
      id: collection?.id ?? `generated-${index}`,
      sourceId: collection?.id ?? null,
      title:
        collection?.name ||
        `${curriculum.themes[0]?.title ?? 'ABU'}: Sammlung ${index + 1}`,
      summary: buildSummary(collection, linkedSheets),
      generated: Boolean(collection?.generated),
      sheets: linkedSheets,
      sheetCount,
      sheetCountLabel: `${sheetCount} ${sheetCount === 1 ? 'Sheet' : 'Sheets'}`,
      moduleCount,
      moduleLabel: `${moduleCount} Module`,
      durationMinutes,
      durationLabel: formatDuration(durationMinutes),
      interactionCount,
      interactionLabel:
        interactionCount > 0 ? `${interactionCount} Interaktionen` : 'ohne Spezialelemente',
      formatLabel: formats.length ? shortList(formats, 2, 'Arbeitsblatt') : 'Arbeitsblatt',
      kLevels: metadata.kLevels,
      kLevelIds: metadata.kLevels.map((entry) => entry.id),
      languageModes: metadata.languageModes,
      languageModeIds: metadata.languageModes.map((entry) => entry.id),
      textBuild: metadata.textBuild,
      textBuildIds: metadata.textBuild.map((entry) => entry.id),
      classicThemes: metadata.classicThemes,
      classicThemeIds: metadata.classicThemes.map((entry) => entry.id),
      societyAspects: metadata.societyAspects,
      societyAspectIds: metadata.societyAspects.map((entry) => entry.id),
      keyCompetencies: metadata.keyCompetencies,
      curriculumThemes: curriculum.themes,
      curriculumThemeIds: curriculum.themes.map((entry) => entry.id),
      subthemes: curriculum.subthemes,
      subthemeIds: curriculum.subthemes.map((entry) => entry.id),
      primarySheetId: primarySheet?.id ?? null,
      priceMode,
      price,
      priceLabel: formatPriceLabel(priceMode, price),
      exchangeLabel:
        priceMode === 'free'
          ? 'Gratis teilen'
          : priceMode === 'school'
          ? 'Schullizenz'
          : 'Sammlungslizenz',
      updatedLabel: formatDate(updatedRaw),
      updatedStamp: latestStamp,
      featuredScore,
      searchIndex: normalizeText(
        [
          collection?.name,
          collection?.description,
          curriculum.themes.map((entry) => entry.label).join(' '),
          curriculum.subthemes.map((entry) => entry.label).join(' '),
          metadata.kLevels.map((entry) => `${entry.id} ${entry.label}`).join(' '),
          metadata.languageModes.map((entry) => entry.label).join(' '),
          metadata.textBuild.map((entry) => entry.label).join(' '),
          metadata.classicThemes.map((entry) => entry.label).join(' '),
          metadata.societyAspects.map((entry) => entry.label).join(' '),
          metadata.keyCompetencies.join(' '),
          linkedSheets.map((sheet) => `${sheet?.name ?? ''} ${sheet?.key ?? ''}`).join(' ')
        ].join(' ')
      )
    };
  };

  const buildGeneratedCollections = (sheetList = []) => {
    const grouped = new Map();
    sheetList.forEach((sheet, index) => {
      const text = normalizeText(`${sheet?.name ?? ''} ${sheet?.key ?? ''} ${sheet?.content ?? ''}`);
      const theme = inferCurriculum(text, hashString(`${sheet?.id ?? index}`)).themes[0];
      const themeId = theme?.id ?? 't1';
      if (!grouped.has(themeId)) grouped.set(themeId, []);
      grouped.get(themeId).push(sheet);
    });

    return [...grouped.entries()].map(([themeId, group], index) => {
      const theme = optionMaps.themes.get(themeId) ?? CURRICULUM_THEMES[0];
      return buildShopCollection(
        {
          id: `generated-${themeId}`,
          name: `${theme.title}: Materialsammlung`,
          description:
            'Automatisch aus vorhandenen Sheets gebündelt, bis echte Shop-Sammlungen gepflegt sind.',
          generated: true,
          updated_at: group[0]?.updated_at ?? group[0]?.created_at ?? ''
        },
        group,
        index
      );
    });
  };

  const buildShopCatalog = (sheetList = [], collectionList = [], linkList = []) => {
    const sheetByOwnerKey = new Map(
      sheetList.map((sheet) => [getSheetLookupKey(sheet?.user, sheet?.key), sheet])
    );
    const sheetByKey = new Map();
    sheetList.forEach((sheet) => {
      if (sheet?.key && !sheetByKey.has(String(sheet.key))) sheetByKey.set(String(sheet.key), sheet);
    });

    const linksByCollection = new Map();
    linkList.forEach((link) => {
      const collectionId = String(link?.collection ?? '');
      if (!collectionId) return;
      if (!linksByCollection.has(collectionId)) linksByCollection.set(collectionId, []);
      linksByCollection.get(collectionId).push(link);
    });

    linksByCollection.forEach((links) => {
      links.sort((a, b) => {
        const posA = Number(a?.position) || 0;
        const posB = Number(b?.position) || 0;
        return posA - posB || String(a?.sheet_key ?? '').localeCompare(String(b?.sheet_key ?? ''));
      });
    });

    const realCollections = collectionList.map((collection, index) => {
      const links = linksByCollection.get(String(collection?.id ?? '')) ?? [];
      const linkedSheets = links
        .map(
          (link) =>
            sheetByOwnerKey.get(getSheetLookupKey(link?.user, link?.sheet_key)) ??
            sheetByKey.get(String(link?.sheet_key ?? ''))
        )
        .filter(Boolean);
      return buildShopCollection(collection, linkedSheets, index, links);
    });

    if (realCollections.length) return realCollections;
    return buildGeneratedCollections(sheetList);
  };

  const resetFilters = () => {
    shopSearch = '';
    selectedKLevels = [];
    selectedModes = [];
    selectedTextBuilds = [];
    selectedClassicThemes = [];
    selectedCurriculumThemes = [];
    selectedSubthemes = [];
    selectedSocietyAspects = [];
    selectedLicenses = [];
    sortBy = 'featured';
    multiSheetOnly = false;
  };

  const matchesActiveCoverageFilters = (entry) => {
    if (normalizedSearch && !entry.searchIndex.includes(normalizedSearch)) return false;
    if (!includesAll(entry.kLevelIds, selectedKLevels)) return false;
    if (!includesAll(entry.languageModeIds, selectedModes)) return false;
    if (!includesAll(entry.textBuildIds, selectedTextBuilds)) return false;
    if (!includesAll(entry.classicThemeIds, selectedClassicThemes)) return false;
    if (!includesAll(entry.curriculumThemeIds, selectedCurriculumThemes)) return false;
    if (!includesAll(entry.societyAspectIds, selectedSocietyAspects)) return false;
    if (selectedLicenses.length && !selectedLicenses.includes(entry.priceMode)) return false;
    if (multiSheetOnly && entry.sheetCount < 2) return false;
    return true;
  };

  $: shopCatalog = buildShopCatalog(sheets, collections, collectionLinks);
  $: aiSearchContext = buildAiSearchContext(aiSearchQuery);
  $: aiSearchResults = buildAiSearchResults(shopCatalog, aiSearchContext);
  $: selectedSubthemeOptions =
    selectedCurriculumThemes.length === 0
      ? allSubthemes
      : allSubthemes.filter((entry) => selectedCurriculumThemes.includes(entry.themeId));
  $: {
    const availableSubthemeIds = new Set(selectedSubthemeOptions.map((entry) => entry.id));
    const nextSubthemes = selectedSubthemes.filter((id) => availableSubthemeIds.has(id));
    if (nextSubthemes.length !== selectedSubthemes.length) {
      selectedSubthemes = nextSubthemes;
    }
  }

  $: normalizedSearch = normalizeText(shopSearch);
  $: filteredShopItems = shopCatalog.filter((entry) => {
    if (!matchesActiveCoverageFilters(entry)) return false;
    if (!includesAll(entry.subthemeIds, selectedSubthemes)) return false;
    return true;
  });

  $: visibleShopItems = [...filteredShopItems].sort((a, b) => {
    if (sortBy === 'updated') {
      return (b.updatedStamp || 0) - (a.updatedStamp || 0) || a.title.localeCompare(b.title);
    }
    if (sortBy === 'price_low') {
      return a.price - b.price || a.title.localeCompare(b.title);
    }
    if (sortBy === 'scope') {
      return b.moduleCount - a.moduleCount || b.sheetCount - a.sheetCount || a.title.localeCompare(b.title);
    }
    if (sortBy === 'alpha') {
      return a.title.localeCompare(b.title, undefined, {
        numeric: true,
        sensitivity: 'base'
      });
    }
    return b.featuredScore - a.featuredScore || a.title.localeCompare(b.title);
  });

  $: coveredSubthemeIds = new Set(shopCatalog.flatMap((entry) => entry.subthemeIds));
  $: missingSubthemes = allSubthemes.filter((entry) => !coveredSubthemeIds.has(entry.id));
  $: coverageItems = shopCatalog.filter(matchesActiveCoverageFilters);
  $: coverageSubthemeIds = new Set(coverageItems.flatMap((entry) => entry.subthemeIds));
  $: coverageScopeSubthemes =
    selectedSubthemes.length
      ? allSubthemes.filter((entry) => selectedSubthemes.includes(entry.id))
      : selectedCurriculumThemes.length === 0
      ? allSubthemes
      : allSubthemes.filter((entry) => selectedCurriculumThemes.includes(entry.themeId));
  $: coverageMissingSubthemes = coverageScopeSubthemes.filter(
    (entry) => !coverageSubthemeIds.has(entry.id)
  );
  $: coverageTitle =
    selectedSubthemes.length
      ? shortList(getSelectedLabels(selectedSubthemes, optionMaps.subthemes), 2)
      : selectedCurriculumThemes.length
      ? shortList(getSelectedLabels(selectedCurriculumThemes, optionMaps.themes), 2)
      : 'Alle SLP-Unterthemen';
  $: shopStats = {
    collections: shopCatalog.length,
    sheets: shopCatalog.reduce((sum, entry) => sum + entry.sheetCount, 0),
    themes: new Set(shopCatalog.flatMap((entry) => entry.curriculumThemeIds)).size,
    missing: missingSubthemes.length
  };

  $: shopSignals = [
    {
      label: 'Shopartikel',
      value: 'Sammlungen',
      copy: 'Ein Angebot ist ein Paket mit mehreren indexierten Lernweg-Anknüpfungen.'
    },
    {
      label: 'Index',
      value: 'SLP 2026',
      copy: 'Sieben Hauptthemen, Unterthemen, Aspekte, Sprachmodi und Schlüsselkompetenzen.'
    },
    {
      label: 'Sprache',
      value: 'Mehrere Modi',
      copy: 'Jede Sammlung führt mehrere Sprachmodi und Textaufbau-Kompetenzen.'
    },
    {
      label: 'Lücken',
      value: `${coverageMissingSubthemes.length}`,
      copy: 'Nicht abgedeckte Unterthemen in der aktuellen Lernweg-Auswahl.'
    }
  ];
</script>

<section class="shop-view" aria-label="Braintrade Shop Mockup">
  <div class="shop-hero">
    <div class="shop-hero__copy">
      <div class="shop-hero__eyebrow-row">
        <span class="shop-eyebrow">Braintrade Beta</span>
        <span class="shop-demo-chip">Sammlungskatalog</span>
      </div>
      <h2>ABU-Sammlungen finden</h2>
      <p class="shop-slogan">{SHOP_SLOGAN}</p>
      <p class="shop-copy">
        Das Mockup indexiert Sammlungen nach dem neuen Schullehrplan, klassischen ABU-Themen,
        K-Stufen, Sprachmodi und Textaufbau. So werden Lücken in Lernwegen sichtbar.
      </p>
      <div class="shop-pill-row" aria-label="Indexkriterien">
        <span class="shop-pill">K1 bis K4</span>
        <span class="shop-pill">9 Sprachmodi</span>
        <span class="shop-pill">Textaufbau</span>
        <span class="shop-pill">7 SLP-Themen</span>
        <span class="shop-pill">Klassische ABU-Themen</span>
      </div>
    </div>

    <div class="shop-hero__signals">
      {#each shopSignals as signal}
        <article class="shop-signal-card">
          <span class="shop-signal-card__label">{signal.label}</span>
          <strong class="shop-signal-card__value">{signal.value}</strong>
          <p>{signal.copy}</p>
        </article>
      {/each}
    </div>
  </div>

  <div class="shop-stat-grid" aria-label="Shop Kennzahlen">
    <article class="shop-stat-card">
      <span class="shop-stat-card__label">Sammlungen</span>
      <strong class="shop-stat-card__value">{shopStats.collections}</strong>
      <p>Shopangebote sind Pakete, nicht einzelne Arbeitsblätter.</p>
    </article>
    <article class="shop-stat-card">
      <span class="shop-stat-card__label">Enthaltene Sheets</span>
      <strong class="shop-stat-card__value">{shopStats.sheets}</strong>
      <p>Vorhandenes Material wird für das Mockup gebündelt.</p>
    </article>
    <article class="shop-stat-card">
      <span class="shop-stat-card__label">SLP-Themen</span>
      <strong class="shop-stat-card__value">{shopStats.themes}</strong>
      <p>Abgedeckte Hauptthemen aus dem neuen Lehrplan.</p>
    </article>
    <article class="shop-stat-card">
      <span class="shop-stat-card__label">Offene Unterthemen</span>
      <strong class="shop-stat-card__value">{shopStats.missing}</strong>
      <p>Unterthemen ohne Treffer im aktuellen Katalog.</p>
    </article>
  </div>

  <section class="shop-ai-card" aria-label="KI Suche">
    <form class="shop-ai-form" on:submit|preventDefault={runAiSearch}>
      <div class="shop-ai-form__copy">
        <span class="shop-ai-card__label">KI Suche</span>
        <h3>Material per Beschreibung finden</h3>
      </div>
      <label class="shop-ai-input">
        <span class="shop-filter-label">Gesuchter Inhalt</span>
        <textarea
          rows="3"
          bind:value={aiSearchInput}
          placeholder="z. B. Konsum, Argumentation, schriftliche Rezeption und multimediale Produktion"
        ></textarea>
      </label>
      <div class="shop-ai-actions">
        <button class="shop-btn shop-btn--primary" type="submit" disabled={!aiSearchInput.trim()}>
          Suchen
        </button>
        <button
          class="shop-btn shop-btn--ghost"
          type="button"
          on:click={resetAiSearch}
          disabled={!aiSearchInput && !aiSearchQuery}
        >
          Leeren
        </button>
      </div>
    </form>

    {#if aiSearchQuery}
      <div class="shop-ai-results">
        <div class="shop-ai-results__header">
          <div>
            <span class="shop-ai-card__label">Treffer</span>
            <strong>{aiSearchResults.length ? aiSearchResults[0].item.title : 'Keine passende Sammlung'}</strong>
          </div>
          <p>{aiSearchResults.length} Resultate für "{aiSearchQuery}"</p>
        </div>

        {#if aiSearchResults.length}
          <div class="shop-ai-result-list">
            {#each aiSearchResults as result, index}
              {@const item = result.item}
              <article class="shop-ai-result">
                <div class="shop-ai-result__rank">{index + 1}</div>
                <div class="shop-ai-result__main">
                  <p class="shop-card__meta">
                    {item.sheetCountLabel} / {item.durationLabel} / {item.exchangeLabel}
                  </p>
                  <h4>{item.title}</h4>
                  <p>{item.summary}</p>
                  <div class="shop-tag-row">
                    {#each result.reasons as reason}
                      <span class="shop-tag shop-tag--accent">{reason}</span>
                    {/each}
                    {#if !result.reasons.length}
                      <span class="shop-tag">Texttreffer</span>
                    {/if}
                  </div>
                </div>
                <div class="shop-ai-result__actions">
                  <span class="shop-ai-score">{result.score}</span>
                  <button
                    class="shop-btn shop-btn--ghost"
                    type="button"
                    on:click={() => item.primarySheetId && onPreviewSheet(item.primarySheetId)}
                    disabled={!item.primarySheetId}
                  >
                    Preview
                  </button>
                </div>
              </article>
            {/each}
          </div>
        {:else}
          <p class="shop-ai-empty">
            Keine Sammlung passt ausreichend. Das ist ein Hinweis auf fehlendes Material im Katalog.
          </p>
        {/if}
      </div>
    {/if}
  </section>

  <div class="shop-filter-card">
    <div class="shop-filter-card__header">
      <div>
        <h3>Indexfilter</h3>
        <p class="shop-filter-card__meta">
          {visibleShopItems.length} von {shopCatalog.length} Sammlungen sichtbar
        </p>
      </div>
      <button class="shop-reset-btn" type="button" on:click={resetFilters}>
        Filter zurücksetzen
      </button>
    </div>

    <div class="shop-filter-grid">
      <label>
        <span class="shop-filter-label">Suche</span>
        <input
          type="text"
          bind:value={shopSearch}
          placeholder="Titel, Lernweg, Modus oder Thema"
        />
      </label>

      <div class="shop-filter-field">
        <span class="shop-filter-label">Neuer SLP</span>
        <details class="shop-filter-dropdown">
          <summary>{formatMultiFilterLabel(selectedCurriculumThemes, 'Alle Hauptthemen', optionMaps.themes)}</summary>
          <div class="shop-filter-menu">
            <button
              class="shop-filter-menu__clear"
              type="button"
              on:click={() => (selectedCurriculumThemes = [])}
              disabled={!selectedCurriculumThemes.length}
            >
              Auswahl leeren
            </button>
          {#each CURRICULUM_THEMES as theme}
              <label class="shop-check-option">
                <input
                  type="checkbox"
                  checked={selectedCurriculumThemes.includes(theme.id)}
                  on:change={() =>
                    (selectedCurriculumThemes = toggleFilterValue(
                      selectedCurriculumThemes,
                      theme.id
                    ))}
                />
                <span class="shop-check-option__box" aria-hidden="true"></span>
                <span class="shop-check-option__text">{theme.label}</span>
              </label>
          {/each}
          </div>
        </details>
      </div>

      <div class="shop-filter-field">
        <span class="shop-filter-label">Unterthema</span>
        <details class="shop-filter-dropdown">
          <summary>{formatMultiFilterLabel(selectedSubthemes, 'Alle Unterthemen', optionMaps.subthemes)}</summary>
          <div class="shop-filter-menu">
            <button
              class="shop-filter-menu__clear"
              type="button"
              on:click={() => (selectedSubthemes = [])}
              disabled={!selectedSubthemes.length}
            >
              Auswahl leeren
            </button>
          {#each selectedSubthemeOptions as subtheme}
              <label class="shop-check-option">
                <input
                  type="checkbox"
                  checked={selectedSubthemes.includes(subtheme.id)}
                  on:change={() =>
                    (selectedSubthemes = toggleFilterValue(selectedSubthemes, subtheme.id))}
                />
                <span class="shop-check-option__box" aria-hidden="true"></span>
                <span class="shop-check-option__text">{subtheme.shortLabel}</span>
              </label>
          {/each}
          </div>
        </details>
      </div>

      <div class="shop-filter-field">
        <span class="shop-filter-label">Sprachmodus</span>
        <details class="shop-filter-dropdown">
          <summary>{formatMultiFilterLabel(selectedModes, 'Alle Modi', optionMaps.modes)}</summary>
          <div class="shop-filter-menu">
            <button
              class="shop-filter-menu__clear"
              type="button"
              on:click={() => (selectedModes = [])}
              disabled={!selectedModes.length}
            >
              Auswahl leeren
            </button>
          {#each LANGUAGE_MODES as mode}
              <label class="shop-check-option">
                <input
                  type="checkbox"
                  checked={selectedModes.includes(mode.id)}
                  on:change={() => (selectedModes = toggleFilterValue(selectedModes, mode.id))}
                />
                <span class="shop-check-option__box" aria-hidden="true"></span>
                <span class="shop-check-option__text">{mode.label}</span>
              </label>
          {/each}
          </div>
        </details>
      </div>

      <div class="shop-filter-field">
        <span class="shop-filter-label">Textaufbau</span>
        <details class="shop-filter-dropdown">
          <summary>{formatMultiFilterLabel(selectedTextBuilds, 'Alle Formen', optionMaps.textBuild)}</summary>
          <div class="shop-filter-menu">
            <button
              class="shop-filter-menu__clear"
              type="button"
              on:click={() => (selectedTextBuilds = [])}
              disabled={!selectedTextBuilds.length}
            >
              Auswahl leeren
            </button>
          {#each TEXT_BUILD_COMPETENCIES as competency}
              <label class="shop-check-option">
                <input
                  type="checkbox"
                  checked={selectedTextBuilds.includes(competency.id)}
                  on:change={() =>
                    (selectedTextBuilds = toggleFilterValue(
                      selectedTextBuilds,
                      competency.id
                    ))}
                />
                <span class="shop-check-option__box" aria-hidden="true"></span>
                <span class="shop-check-option__text">{competency.label}</span>
              </label>
          {/each}
          </div>
        </details>
      </div>

      <div class="shop-filter-field">
        <span class="shop-filter-label">K-Stufe</span>
        <details class="shop-filter-dropdown">
          <summary>{formatMultiFilterLabel(selectedKLevels, 'Alle K-Stufen', optionMaps.k)}</summary>
          <div class="shop-filter-menu">
            <button
              class="shop-filter-menu__clear"
              type="button"
              on:click={() => (selectedKLevels = [])}
              disabled={!selectedKLevels.length}
            >
              Auswahl leeren
            </button>
          {#each SHOP_K_LEVELS as level}
              <label class="shop-check-option">
                <input
                  type="checkbox"
                  checked={selectedKLevels.includes(level.id)}
                  on:change={() => (selectedKLevels = toggleFilterValue(selectedKLevels, level.id))}
                />
                <span class="shop-check-option__box" aria-hidden="true"></span>
                <span class="shop-check-option__text">{level.label}</span>
              </label>
          {/each}
          </div>
        </details>
      </div>

      <div class="shop-filter-field">
        <span class="shop-filter-label">Klassisch</span>
        <details class="shop-filter-dropdown">
          <summary>{formatMultiFilterLabel(selectedClassicThemes, 'Alle ABU-Themen', optionMaps.classic)}</summary>
          <div class="shop-filter-menu">
            <button
              class="shop-filter-menu__clear"
              type="button"
              on:click={() => (selectedClassicThemes = [])}
              disabled={!selectedClassicThemes.length}
            >
              Auswahl leeren
            </button>
          {#each CLASSIC_THEMES as theme}
              <label class="shop-check-option">
                <input
                  type="checkbox"
                  checked={selectedClassicThemes.includes(theme.id)}
                  on:change={() =>
                    (selectedClassicThemes = toggleFilterValue(
                      selectedClassicThemes,
                      theme.id
                    ))}
                />
                <span class="shop-check-option__box" aria-hidden="true"></span>
                <span class="shop-check-option__text">{theme.label}</span>
              </label>
          {/each}
          </div>
        </details>
      </div>

      <div class="shop-filter-field">
        <span class="shop-filter-label">Aspekt</span>
        <details class="shop-filter-dropdown">
          <summary>{formatMultiFilterLabel(selectedSocietyAspects, 'Alle Aspekte', optionMaps.aspects)}</summary>
          <div class="shop-filter-menu">
            <button
              class="shop-filter-menu__clear"
              type="button"
              on:click={() => (selectedSocietyAspects = [])}
              disabled={!selectedSocietyAspects.length}
            >
              Auswahl leeren
            </button>
          {#each SOCIETY_ASPECTS as aspect}
              <label class="shop-check-option">
                <input
                  type="checkbox"
                  checked={selectedSocietyAspects.includes(aspect.id)}
                  on:change={() =>
                    (selectedSocietyAspects = toggleFilterValue(
                      selectedSocietyAspects,
                      aspect.id
                    ))}
                />
                <span class="shop-check-option__box" aria-hidden="true"></span>
                <span class="shop-check-option__text">{aspect.label}</span>
              </label>
          {/each}
          </div>
        </details>
      </div>

      <div class="shop-filter-field">
        <span class="shop-filter-label">Lizenz</span>
        <details class="shop-filter-dropdown">
          <summary>{formatMultiFilterLabel(selectedLicenses, 'Alle Lizenzen', optionMaps.licenses)}</summary>
          <div class="shop-filter-menu">
            <button
              class="shop-filter-menu__clear"
              type="button"
              on:click={() => (selectedLicenses = [])}
              disabled={!selectedLicenses.length}
            >
              Auswahl leeren
            </button>
            {#each LICENSE_OPTIONS as license}
              <label class="shop-check-option">
                <input
                  type="checkbox"
                  checked={selectedLicenses.includes(license.id)}
                  on:change={() =>
                    (selectedLicenses = toggleFilterValue(selectedLicenses, license.id))}
                />
                <span class="shop-check-option__box" aria-hidden="true"></span>
                <span class="shop-check-option__text">{license.label}</span>
              </label>
            {/each}
          </div>
        </details>
      </div>

      <label>
        <span class="shop-filter-label">Sortierung</span>
        <select bind:value={sortBy}>
          {#each SHOP_SORT_OPTIONS as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
    </div>

    <div class="shop-toggle-row">
      <button
        class="shop-toggle"
        class:is-active={multiSheetOnly}
        type="button"
        on:click={() => (multiSheetOnly = !multiSheetOnly)}
      >
        Nur Sammlungen mit mehreren Sheets
      </button>
      <p class="shop-filter-note">
        Die Heuristik nutzt Titel, Beschreibungen und Sheet-Inhalte. Später sollten diese
        Felder als echte Metadaten beim Import und beim Publizieren gepflegt werden.
      </p>
    </div>
  </div>

  <div class="shop-learning-path" aria-label="Lernweg Abdeckung">
    <div>
      <span class="shop-learning-path__label">Lernweg-Abdeckung</span>
      <strong>{coverageTitle}</strong>
      <p>
        {coverageScopeSubthemes.length - coverageMissingSubthemes.length} von
        {coverageScopeSubthemes.length} Unterthemen sind mit der aktuellen Auswahl abgedeckt.
      </p>
    </div>
    <div class="shop-gap-list">
      {#if coverageMissingSubthemes.length}
        <span>Fehlendes Material</span>
        <p>{shortList(coverageMissingSubthemes.map((entry) => entry.shortLabel), 4)}</p>
      {:else}
        <span>Fehlendes Material</span>
        <p>Keine Lücke für diese Auswahl.</p>
      {/if}
    </div>
  </div>

  {#if loading}
    <div class="shop-empty-state">
      <h3>Sammlungen werden geladen</h3>
      <p>Die bestehenden Materialien werden für den Braintrade-Katalog vorbereitet.</p>
    </div>
  {:else if error && !shopCatalog.length}
    <div class="shop-empty-state shop-empty-state--error">
      <h3>Shopdaten konnten nicht geladen werden</h3>
      <p>{error}</p>
    </div>
  {:else if !shopCatalog.length}
    <div class="shop-empty-state">
      <h3>Noch keine Sammlungen vorhanden</h3>
      <p>Lege zuerst Sammlungen oder Sheets an. Danach erscheinen sie hier als Katalogpakete.</p>
    </div>
  {:else}
    {#if error}
      <p class="shop-inline-error">{error}</p>
    {/if}

    {#if !visibleShopItems.length}
      <div class="shop-empty-state">
        <h3>Keine Sammlung für diese Lernweg-Kombination</h3>
        <p>
          Diese Filterkombination kann als Materiallücke markiert werden:
          {buildEmptyFilterSummary()}.
        </p>
      </div>
    {:else}
      <div class="shop-list" role="list">
        {#each visibleShopItems as item}
          <article class="shop-list-item" role="listitem">
            <div class="shop-list-item__main">
              <div class="shop-list-item__header">
                <div class="shop-list-item__heading">
                  <p class="shop-card__meta">
                    Sammlung / {item.sheetCountLabel} / aktualisiert {item.updatedLabel}
                  </p>
                  <h3>{item.title}</h3>
                  <p class="shop-list-item__lead">
                    {shortList(item.curriculumThemes.map((entry) => entry.label), 2)}
                  </p>
                </div>
                <span class="shop-price-badge" data-mode={item.priceMode}>{item.priceLabel}</span>
              </div>

              <p class="shop-card__summary">{item.summary}</p>

              <div class="shop-tag-row" aria-label="Index Tags">
                {#each item.kLevels as level}
                  <span class="shop-tag shop-tag--k">{level.id}</span>
                {/each}
                {#each item.languageModes.slice(0, 4) as mode}
                  <span class="shop-tag shop-tag--accent">{mode.shortLabel}</span>
                {/each}
                {#each item.textBuild.slice(0, 3) as competency}
                  <span class="shop-tag">{competency.label}</span>
                {/each}
                {#each item.classicThemes.slice(0, 2) as theme}
                  <span class="shop-tag">{theme.label}</span>
                {/each}
              </div>

              <div class="shop-card__signals">
                <span>{item.moduleLabel}</span>
                <span>{item.interactionLabel}</span>
                <span>{item.languageModes.length} Sprachmodi</span>
                <span>{item.subthemes.length} SLP-Unterthemen</span>
              </div>
            </div>

            <aside class="shop-list-item__side" aria-label={`Details zu ${item.title}`}>
              <div class="shop-fact-row">
                <span>Unterthemen</span>
                <strong>{shortList(item.subthemes.map((entry) => entry.shortLabel), 3)}</strong>
              </div>
              <div class="shop-fact-row">
                <span>Sprachmodi</span>
                <strong>{shortList(item.languageModes.map((entry) => entry.shortLabel), 4)}</strong>
              </div>
              <div class="shop-fact-row">
                <span>Textaufbau</span>
                <strong>{shortList(item.textBuild.map((entry) => entry.label), 3)}</strong>
              </div>
              <div class="shop-fact-row">
                <span>Gesellschaft</span>
                <strong>{shortList(item.societyAspects.map((entry) => entry.label), 3)}</strong>
              </div>
              <div class="shop-fact-row">
                <span>Schlüsselkompetenzen</span>
                <strong>{shortList(item.keyCompetencies, 3)}</strong>
              </div>
              <div class="shop-fact-row">
                <span>Lizenz</span>
                <strong>{item.exchangeLabel}</strong>
              </div>

              <div class="shop-card__actions">
                <button
                  class="shop-btn shop-btn--ghost"
                  type="button"
                  on:click={() => item.primarySheetId && onPreviewSheet(item.primarySheetId)}
                  disabled={!item.primarySheetId}
                >
                  Preview
                </button>
                <button
                  class="shop-btn shop-btn--primary"
                  type="button"
                  on:click={() => item.primarySheetId && onOpenSheet(item.primarySheetId)}
                  disabled={!item.primarySheetId}
                >
                  Erstes Sheet öffnen
                </button>
              </div>
            </aside>
          </article>
        {/each}
      </div>
    {/if}
  {/if}
</section>

<style>
  .shop-view {
    display: grid;
    gap: 18px;
    font-size: 14px;
    color: #163047;
  }

  .shop-hero {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.95fr);
    gap: 18px;
    padding: clamp(20px, 3vw, 28px);
    border-radius: 18px;
    background: #f7fafc;
    border: 1px solid #dce6f0;
  }

  .shop-hero__copy {
    display: grid;
    gap: 13px;
    align-content: start;
  }

  .shop-hero__eyebrow-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .shop-eyebrow,
  .shop-demo-chip {
    display: inline-flex;
    align-items: center;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .shop-eyebrow {
    background: rgba(15, 118, 110, 0.12);
    color: #0f766e;
  }

  .shop-demo-chip {
    background: #fff;
    color: #495568;
    border: 1px solid #d7e0ea;
  }

  .shop-hero h2 {
    margin: 0;
    font-size: clamp(30px, 3.1vw, 44px);
    line-height: 1;
    letter-spacing: 0;
    font-family: 'Space Grotesk', sans-serif;
  }

  .shop-slogan {
    margin: 0;
    font-size: clamp(16px, 1.5vw, 19px);
    font-weight: 700;
    color: #0f766e;
  }

  .shop-copy {
    margin: 0;
    max-width: 66ch;
    line-height: 1.55;
    color: #415062;
  }

  .shop-pill-row,
  .shop-tag-row,
  .shop-card__signals {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
  }

  .shop-pill,
  .shop-tag,
  .shop-card__signals span {
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    line-height: 1.25;
  }

  .shop-pill {
    background: #fff;
    border: 1px solid #d7e0ea;
    color: #2f3f52;
  }

  .shop-hero__signals {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .shop-signal-card,
  .shop-stat-card,
  .shop-ai-card,
  .shop-filter-card,
  .shop-learning-path,
  .shop-list-item,
  .shop-empty-state {
    border: 1px solid #dce6f0;
    background: #fff;
    box-shadow: 0 12px 24px rgba(15, 23, 42, 0.05);
  }

  .shop-signal-card {
    display: grid;
    gap: 7px;
    padding: 14px;
    border-radius: 12px;
  }

  .shop-signal-card p,
  .shop-stat-card p,
  .shop-learning-path p {
    margin: 0;
    color: #556476;
    line-height: 1.4;
    font-size: 12px;
  }

  .shop-signal-card__label,
  .shop-stat-card__label,
  .shop-learning-path__label,
  .shop-gap-list span,
  .shop-filter-label,
  .shop-fact-row span {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #7c6e63;
  }

  .shop-signal-card__value {
    font-size: 16px;
    line-height: 1.1;
  }

  .shop-stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 10px;
  }

  .shop-stat-card {
    display: grid;
    gap: 7px;
    padding: 15px;
    border-radius: 12px;
  }

  .shop-stat-card__value {
    font-size: clamp(24px, 2.4vw, 32px);
    line-height: 1;
    font-family: 'Space Grotesk', sans-serif;
  }

  .shop-ai-card {
    display: grid;
    gap: 14px;
    padding: 17px;
    border-radius: 14px;
  }

  .shop-ai-form {
    display: grid;
    grid-template-columns: minmax(180px, 0.55fr) minmax(260px, 1fr) auto;
    gap: 12px;
    align-items: end;
  }

  .shop-ai-form__copy {
    display: grid;
    gap: 5px;
    align-self: center;
  }

  .shop-ai-form__copy h3 {
    margin: 0;
    font-size: 18px;
  }

  .shop-ai-card__label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #0f766e;
  }

  .shop-ai-input {
    display: grid;
    gap: 6px;
    margin: 0;
  }

  .shop-ai-input textarea {
    width: 100%;
    min-height: 86px;
    resize: vertical;
    font: inherit;
    padding: 11px 12px;
    border-radius: 10px;
    border: 1px solid #d7e0ea;
    background: #fff;
    color: #163047;
    line-height: 1.45;
  }

  .shop-ai-input textarea:focus {
    outline: none;
    border-color: #0f766e;
    box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
  }

  .shop-ai-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
    justify-content: flex-end;
  }

  .shop-ai-results {
    display: grid;
    gap: 10px;
    padding-top: 13px;
    border-top: 1px solid #dce6f0;
  }

  .shop-ai-results__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }

  .shop-ai-results__header strong {
    display: block;
    margin-top: 4px;
    font-size: 17px;
    line-height: 1.25;
  }

  .shop-ai-results__header p,
  .shop-ai-result p,
  .shop-ai-empty {
    margin: 0;
    color: #556476;
    line-height: 1.45;
  }

  .shop-ai-result-list {
    display: grid;
    gap: 9px;
  }

  .shop-ai-result {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto;
    gap: 12px;
    align-items: start;
    padding: 12px;
    border-radius: 12px;
    border: 1px solid #dce6f0;
    background: #f8fafc;
  }

  .shop-ai-result__rank,
  .shop-ai-score {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    font-weight: 800;
  }

  .shop-ai-result__rank {
    width: 30px;
    height: 30px;
    background: rgba(15, 118, 110, 0.12);
    color: #0f766e;
  }

  .shop-ai-result__main {
    display: grid;
    gap: 8px;
  }

  .shop-ai-result__main h4 {
    margin: 0;
    font-size: 16px;
  }

  .shop-ai-result__actions {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .shop-ai-score {
    min-width: 34px;
    height: 28px;
    padding: 0 9px;
    background: #eef3ff;
    color: #1d4ed8;
    font-size: 11px;
  }

  .shop-filter-card {
    display: grid;
    gap: 15px;
    padding: 17px;
    border-radius: 14px;
  }

  .shop-filter-card__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }

  .shop-filter-card__header h3 {
    margin: 0 0 3px;
    font-size: 18px;
  }

  .shop-filter-card__meta {
    margin: 0;
    color: #64748b;
    font-size: 13px;
  }

  .shop-filter-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(172px, 1fr));
    gap: 10px;
  }

  .shop-filter-grid > label,
  .shop-filter-field {
    display: grid;
    gap: 6px;
    margin: 0;
    font-size: 12px;
    font-weight: 600;
    color: #425466;
  }

  .shop-filter-grid > label > input,
  .shop-filter-grid > label > select,
  .shop-filter-dropdown summary {
    width: 100%;
    min-height: 42px;
    font: inherit;
    padding: 10px 12px;
    border-radius: 10px;
    border: 1px solid #d7e0ea;
    background: #fff;
    color: #163047;
  }

  .shop-filter-grid > label > input:focus,
  .shop-filter-grid > label > select:focus,
  .shop-filter-dropdown summary:focus-visible {
    outline: none;
    border-color: #0f766e;
    box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.12);
  }

  .shop-filter-dropdown {
    position: relative;
  }

  .shop-filter-dropdown summary {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    cursor: pointer;
    list-style: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .shop-filter-dropdown summary::-webkit-details-marker {
    display: none;
  }

  .shop-filter-dropdown summary::after {
    content: '';
    width: 7px;
    height: 7px;
    flex: 0 0 auto;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    opacity: 0.65;
    transform: rotate(45deg) translateY(-2px);
  }

  .shop-filter-dropdown[open] summary::after {
    transform: rotate(225deg) translateY(-1px);
  }

  .shop-filter-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    z-index: 20;
    display: grid;
    gap: 4px;
    width: min(340px, 88vw);
    max-height: 320px;
    overflow: auto;
    padding: 8px;
    border-radius: 12px;
    border: 1px solid #d7e0ea;
    background: #fff;
    box-shadow: 0 18px 36px rgba(15, 23, 42, 0.16);
  }

  .shop-filter-menu__clear {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    min-height: 31px;
    border: 1px solid #d7e0ea;
    border-radius: 8px;
    background: #f8fafc;
    color: #23405a;
    font: inherit;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }

  .shop-filter-menu__clear:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .shop-check-option {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    min-height: 35px;
    padding: 7px 8px;
    border-radius: 9px;
    color: #25384d;
    cursor: pointer;
  }

  .shop-check-option:hover {
    background: #f2f7f9;
  }

  .shop-check-option input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .shop-check-option__box {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 5px;
    border: 1px solid #b8c6d5;
    background: #fff;
  }

  .shop-check-option input:checked + .shop-check-option__box {
    border-color: #0f766e;
    background: #0f766e;
  }

  .shop-check-option input:checked + .shop-check-option__box::after {
    content: '';
    width: 8px;
    height: 4px;
    border-left: 2px solid #fff;
    border-bottom: 2px solid #fff;
    transform: rotate(-45deg) translate(1px, -1px);
  }

  .shop-check-option input:focus-visible + .shop-check-option__box {
    box-shadow: 0 0 0 3px rgba(15, 118, 110, 0.16);
  }

  .shop-check-option__text {
    min-width: 0;
    overflow-wrap: anywhere;
    line-height: 1.25;
    font-size: 12px;
  }

  .shop-toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    flex-wrap: wrap;
  }

  .shop-filter-note {
    margin: 0;
    color: #64748b;
    font-size: 12px;
    line-height: 1.4;
    max-width: 72ch;
  }

  .shop-learning-path {
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(240px, 0.9fr);
    gap: 16px;
    align-items: start;
    padding: 16px 17px;
    border-radius: 14px;
  }

  .shop-learning-path strong {
    display: block;
    margin: 4px 0;
    font-size: 18px;
  }

  .shop-gap-list {
    display: grid;
    gap: 5px;
    padding-left: 16px;
    border-left: 1px solid #dce6f0;
  }

  .shop-list {
    display: grid;
    gap: 14px;
  }

  .shop-list-item {
    display: grid;
    grid-template-columns: minmax(0, 1.55fr) minmax(240px, 0.9fr);
    gap: 16px;
    align-items: start;
    padding: 17px;
    border-radius: 14px;
  }

  .shop-list-item__main {
    display: grid;
    gap: 14px;
  }

  .shop-list-item__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }

  .shop-list-item__heading {
    display: grid;
    gap: 5px;
  }

  .shop-list-item__heading h3 {
    margin: 4px 0 0;
    font-size: 20px;
    line-height: 1.1;
    letter-spacing: 0;
  }

  .shop-list-item__lead {
    margin: 0;
    color: #0f766e;
    font-size: 13px;
    font-weight: 700;
    line-height: 1.45;
  }

  .shop-card__meta {
    margin: 0;
    color: #748294;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.12em;
  }

  .shop-card__summary {
    margin: 0;
    color: #4a5a6b;
    line-height: 1.5;
  }

  .shop-tag {
    background: #eff4f8;
    color: #35506a;
  }

  .shop-tag--accent {
    background: rgba(15, 118, 110, 0.12);
    color: #0f766e;
  }

  .shop-tag--k {
    background: #eef3ff;
    color: #1d4ed8;
  }

  .shop-list-item__side {
    display: grid;
    gap: 9px;
    padding-left: 16px;
    border-left: 1px solid #dce6f0;
  }

  .shop-fact-row {
    display: grid;
    gap: 3px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(148, 163, 184, 0.22);
  }

  .shop-fact-row:last-of-type {
    border-bottom: none;
  }

  .shop-fact-row strong {
    line-height: 1.35;
  }

  .shop-card__signals span {
    background: #fff7ed;
    color: #9a4d11;
  }

  .shop-card__actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: stretch;
    margin-top: 4px;
  }

  .shop-btn,
  .shop-toggle,
  .shop-reset-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid transparent;
    border-radius: 999px;
    font: inherit;
    font-size: 13px;
    font-weight: 700;
    cursor: pointer;
    transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
  }

  .shop-btn:hover:not(:disabled),
  .shop-toggle:hover,
  .shop-reset-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 15px rgba(15, 23, 42, 0.12);
  }

  .shop-btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .shop-btn,
  .shop-reset-btn {
    padding: 9px 14px;
  }

  .shop-btn--primary {
    background: linear-gradient(135deg, #0f766e 0%, #1d4ed8 100%);
    color: #fff;
    border-color: rgba(15, 118, 110, 0.2);
  }

  .shop-btn--ghost,
  .shop-reset-btn {
    background: #fff;
    color: #23405a;
    border-color: #d7e0ea;
  }

  .shop-toggle {
    padding: 9px 12px;
    background: #eff4f8;
    color: #35506a;
    border-color: #d7e0ea;
  }

  .shop-toggle.is-active {
    background: rgba(15, 118, 110, 0.12);
    border-color: rgba(15, 118, 110, 0.28);
    color: #0f766e;
  }

  .shop-price-badge {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    padding: 7px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 800;
    white-space: nowrap;
    color: #12344f;
    background: #eff4f8;
  }

  .shop-price-badge[data-mode='free'] {
    background: #e7f7ef;
    color: #0f766e;
  }

  .shop-price-badge[data-mode='collection'] {
    background: #fff4e8;
    color: #c96f32;
  }

  .shop-price-badge[data-mode='school'] {
    background: #eef3ff;
    color: #1d4ed8;
  }

  .shop-empty-state {
    display: grid;
    gap: 7px;
    padding: 24px;
    border-radius: 14px;
    text-align: center;
  }

  .shop-empty-state h3,
  .shop-empty-state p,
  .shop-inline-error {
    margin: 0;
  }

  .shop-empty-state p {
    color: #5f6f82;
    line-height: 1.45;
  }

  .shop-empty-state--error {
    border-color: rgba(226, 114, 114, 0.35);
  }

  .shop-inline-error {
    color: #b23a3a;
    font-weight: 600;
  }

  @media (max-width: 1040px) {
    .shop-hero,
    .shop-ai-form,
    .shop-learning-path,
    .shop-list-item {
      grid-template-columns: 1fr;
    }

    .shop-list-item__side,
    .shop-gap-list {
      padding-left: 0;
      border-left: none;
      border-top: 1px solid #dce6f0;
      padding-top: 14px;
    }

    .shop-ai-actions,
    .shop-ai-result__actions {
      justify-content: flex-start;
    }
  }

  @media (max-width: 760px) {
    .shop-hero__signals {
      grid-template-columns: 1fr;
    }

    .shop-list-item__header {
      flex-direction: column;
    }

    .shop-ai-result {
      grid-template-columns: 30px minmax(0, 1fr);
    }

    .shop-ai-result__actions {
      grid-column: 2;
    }
  }

  @media (max-width: 640px) {
    .shop-filter-card,
    .shop-list-item,
    .shop-stat-card,
    .shop-ai-card,
    .shop-learning-path {
      padding: 14px;
    }

    .shop-hero {
      padding: 17px;
    }

    .shop-card__actions {
      flex-direction: column;
    }

    .shop-btn,
    .shop-reset-btn {
      width: 100%;
      justify-content: center;
    }
  }
</style>
