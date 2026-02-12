export type LegacySheet = {
  key: string;
  name: string;
  content: string;
};

export const legacySheets: LegacySheet[] = [
  {
    key: 'eu',
    name: 'Aufgabe 1: Schweiz und EU',
    content: `
<section>
      <p>
        Schauen Sie den Film über die Beziehung der Schweiz zur EU. Sie finden den Erklärclip auf
        <a href="https://www.easyvote.ch" target="_blank" rel="noopener noreferrer">easyvote.ch</a>
        unter <strong>Wissen &gt; Internationale Politik &gt; Europäische Union</strong>. Füllen Sie mit Hilfe des Films die untenstehenden Lücken aus.
      </p>

      <div class="video-container" aria-label="Erklärvideo: Die EU und die Schweiz">
        <iframe
          src="https://www.youtube.com/embed/KEQaXHlqFsI"
          title="Die EU und die Schweiz - einfach und neutral erklärt!"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>
      </div>

      <p>
        Die Schweiz hat viele Verträge mit internationalen Organisationen und anderen Ländern. Der wichtigste Partner der Schweiz ist
        <luecke-gap name="luecke1">die Europäische Union (EU)</luecke-gap>. Sie ist ein Staatenverbund.
      </p>

      <p>
        Das bedeutet einerseits, dass Bürger der EU
        <luecke-gap name="luecke4">frei wählen</luecke-gap>
        können, wo sie wohnen und arbeiten
        (<luecke-gap name="luecke5">Personenfreizügigkeit</luecke-gap>)
        und andererseits, dass es einheitliche Gesetze und keine Zölle zwischen den
        <luecke-gap name="luecke6">Mitgliedstaaten</luecke-gap>
        gibt.
      </p>

      <p>
        Die Schweiz hat viele Verträge mit der EU abgeschlossen, um gleichberechtigt am europäischen
        <luecke-gap name="luecke7">europäischen Binnenmarkt</luecke-gap>
        teilnehmen zu können. Man nennt diese Verträge auch
        <luecke-gap name="luecke8">bilaterale Verträge</luecke-gap>.
        Da die EU ihre Gesetze laufend anpasst und erweitert, muss auch die Schweiz regelmässig ihre Gesetze und Verträge anpassen.
      </p>

      <p>
        Um diesen Prozess zu vereinfachen, könnte man ein
        <luecke-gap name="luecke9"> Rahmenabkommen </luecke-gap>
        abschliessen. Dieses kam jedoch nicht zustande, weil die Mehrheit des Parlamentes dagegen war. Ein wichtiges Argument gegen das Rahmenabkommen war
        <luecke-gap name="luecke10">Schutz der Schweizer Löhne und der nationalen Souveränität</luecke-gap>.
        Die Befürworter des Rahmenabkommens hingegen betonen die Vorteile
        <luecke-gap name="luecke11">einer stabilen Zusammenarbeit und eines gesicherten Zugangs zum EU-Binnenmarkt</luecke-gap>
        zwischen der Schweiz und der EU.
      </p>
    </section>
    <div class="next-step" data-unlock-percent="90" hidden>
      <a class="next-step__link" href="/sheet/menschen">Weiter zu Aufgabe 2: Vorsicht "Rosa Brille"</a>
    </div>
`,
  },
  {
    key: 'menschen',
    name: 'Aufgabe 2: Vorsicht Rosa Brille',
    content: `
<section>
      <p>
        Stellen Sie sich vor, Sie lernen in Spanien Ihre grosse Liebe kennen. Was hat die Beziehung zwischen der Schweiz und der EU mit Ihrer persönlichen Situation zu tun?
        Schauen Sie den SRF-MySchool-Clip <strong>"Vorsicht: Rosa Brille"</strong> und beantworten Sie die Fragen.
      </p>

      <div class="video-container" aria-label="SRF MySchool - Vorsicht Rosa Brille">
        <iframe
          src="https://www.srf.ch/play/embed?urn=urn:srf:video:97409c52-2de6-4068-9ca4-45cef5e6b7de&subdivisions=false"
          title="SRF MySchool - Vorsicht Rosa Brille"
          allow="geolocation *; autoplay; encrypted-media"
          allowfullscreen
        ></iframe>
      </div>

      <p>
        <strong>Lernziele</strong><br>
        - Ich kann einen persönlichen Bezug zum Personenfreizügigkeitsabkommen herstellen.<br>
        - Ich kann nachvollziehen, was der Wegfall des Personenfreizügigkeitsabkommens bedeuten würde.<br>
        - Ich erkenne eine aktuelle Problematik des Personenfreizügigkeitsabkommens.
      </p>

      <p>
        <strong>Glossar</strong><br>
        - Napoleon-Komplex: Grössenunterschiede werden durch sichtbare Erfolge oder Statussymbole kompensiert.<br>
        - Personenfreizügigkeitsabkommen (Bilaterale I): EU- und Schweizer BürgerInnen können ihren Arbeits- und Wohnort frei wählen; Berufsqualifikationen werden gegenseitig anerkannt.
      </p>

      <p><strong>Fragen zum Film</strong></p>
      <p>
        Erklären Sie die Redewendung "Etwas durch die rosa Brille sehen".<br>
        <luecke-gap-wide name="rosa1">Die Redewendung bedeutet, dass man alles zu positiv sieht und Probleme ausblendet.</luecke-gap-wide>
      </p>
      <p>
        Dank welchem Abkommen können Schweizer in viele Ländern Europas ohne Ausweiskontrolle reisen?<br>
        <luecke-gap-wide name="rosa4" data-accepted="Schengen;Schengen-Abkommen;Schengener Abkommen">Dank des Schengen-Abkommens kann man in vielen europäischen Ländern reisen, ohne lange Grenz- und Ausweiskontrollen.</luecke-gap-wide>
      </p>
      <p>
        Was ist für Sie persönlich ein Vorteil des Luftverkehrsabkommens?<br>
        <luecke-gap-wide name="rosa2">Mehr Flugverbindungen und tiefere Preise dank offenem Zugang zu EU-Strecken.</luecke-gap-wide>
      </p>
      <p>
        Dank welchem Abkommen sind viele Schweizer Berufsqualifikationen im gesamten EU-Raum anerkannt?<br>
        <luecke-gap-wide name="rosa3" data-accepted="Personenfreizügigkeitsabkommen;Bilaterale I">Das Personenfreizügigkeitsabkommen.</luecke-gap-wide>
      </p>
    </section>
    <div class="next-step" data-unlock-percent="90" hidden>
      <a class="next-step__link" href="/sheet/waren">Weiter zu Aufgabe 3: Agrarhandel Schweiz - EU</a>
    </div>
`,
  },
  {
    key: 'waren',
    name: 'Aufgabe 3: Agrarfreihandel',
    content: `
<section>
      <p>
        Schauen Sie den SRF-MySchool-Clip zu «Agrarfreihandel Schweiz - EU» und beantworten Sie die Fragen.
      </p>

      <div class="video-container" aria-label="SRF MySchool - Agrarfreihandel Schweiz EU">
        <iframe
          src="https://www.srf.ch/play/embed?urn=urn:srf:video:c718a93c-8f70-4963-b5a1-bfe6d3242d27&subdivisions=false"
          title="SRF MySchool - Agrarfreihandel Schweiz EU"
          allow="geolocation *; autoplay; encrypted-media"
          allowfullscreen
        ></iframe>
      </div>

      <!--<p><strong>Kernaussagen aus dem Film (Stichworte)</strong><br>
        - Lebensmittel sind in der EU oft günstiger, Schweizer Produzenten geraten unter Preisdruck.<br>
        - EU-Binnenmarkt: keine Zölle, mehr Wettbewerb, tiefere Preise.<br>
        - Schweiz schützt die eigene Produktion mit Zöllen, dadurch höhere Preise.<br>
        - Eigenversorgung liegt etwa bei der Hälfte des Bedarfs; Importe bleiben nötig.<br>
        - Agrarfreihandelsabkommen: tiefere Preise, aber Risiko eines Bauernsterbens.
      </p>-->

      <p><strong>Fragen zum Film</strong></p>
      <p>
        Warum sind Lebensmittel in der EU oft günstiger als in der Schweiz?<br>
        <luecke-gap-wide name="waren1" data-accepted="Binnenmarkt;keine zoelle;mehr Wettbewerb">Wegen des EU-Binnenmarkts ohne Zölle gibt es mehr Wettbewerb und tiefere Preise.</luecke-gap-wide>
      </p>
      <p>
        Wie schützt die Schweiz ihre landwirtschaftliche Produktion heute?<br>
        <luecke-gap-wide name="waren2" data-accepted="Zoelle;Grenzschutz">Durch Zölle und Grenzschutz, was in der Schweiz zu höheren Preisen führt.</luecke-gap-wide>
      </p>
      <p>
        Wie hoch ist etwa der Eigenversorgungsgrad der Schweiz und was bedeutet das?<br>
        <luecke-gap-wide name="waren3" data-accepted="Haelfte;50%;Eigenversorgungsgrad">Rund die Hälfte des Bedarfs wird selbst produziert, der Rest muss importiert werden.</luecke-gap-wide>
      </p>
      <p>
        Nennen Sie einen möglichen Vorteil und einen möglichen Nachteil eines Agrarfreihandelsabkommens mit der EU.<br>
        <luecke-gap-wide name="waren4" data-accepted="tiefere preise;bauernerzeugnisse;bauernsterben;druck auf bauern">Vorteil: tiefere Preise für Konsumierende; Nachteil: Druck auf Bauern bis hin zum Bauernsterben.</luecke-gap-wide>
      </p>
    </section>
    <div class="next-step" data-unlock-percent="90" hidden>
      <a class="next-step__link" href="/">Du bist fertig – Gratulation!</a>
    </div>
`,
  },
];
