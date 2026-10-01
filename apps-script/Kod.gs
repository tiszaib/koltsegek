// Ezt a kódot a "Költségeim" Google Táblázat Apps Script szerkesztőjébe kell bemásolni
// (Bővítmények > Apps Script). A telefonos app ide küldi a tételeket.

const ADAT_LAP = 'Kiadások';
const OSSZESITO_LAP = 'Összesítő';

function doPost(e) {
  const zar = LockService.getScriptLock();
  zar.waitLock(15000);
  try {
    const t = JSON.parse(e.postData.contents);
    const osszeg = Number(t.osszeg);
    if (!(osszeg > 0)) throw new Error('Hibás összeg');

    const lap = beallitas();
    const id = String(t.id || '');

    // Ha ugyanaz a tétel kétszer érkezik (pl. rossz net miatt), csak egyszer írjuk be.
    if (id) {
      const utolso = lap.getLastRow();
      if (utolso > 1) {
        const kezdo = Math.max(2, utolso - 99);
        const idk = lap.getRange(kezdo, 5, utolso - kezdo + 1, 1).getValues().flat();
        if (idk.indexOf(id) !== -1) return valasz_({ ok: true, duplikalt: true });
      }
    }

    const datum = t.datum ? new Date(t.datum) : new Date();
    const sor = lap.getLastRow() + 1;
    lap.getRange(sor, 1, 1, 5).setValues([[
      datum,
      String(t.nev || '').slice(0, 200),
      osszeg,
      String(t.kategoria || 'Egyéb').slice(0, 50),
      id,
    ]]);
    return valasz_({ ok: true });
  } catch (hiba) {
    return valasz_({ ok: false, hiba: String(hiba) });
  } finally {
    zar.releaseLock();
  }
}

function doGet() {
  return valasz_({ ok: true, uzenet: 'A költségkövető működik.' });
}

function valasz_(adat) {
  return ContentService.createTextOutput(JSON.stringify(adat)).setMimeType(ContentService.MimeType.JSON);
}

// Létrehozza a lapokat és a kördiagramot. Elég egyszer lefuttatni, de nem baj, ha többször fut.
function beallitas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let lap = ss.getSheetByName(ADAT_LAP);
  if (lap) return lap;

  lap = ss.getSheets()[0];
  lap.setName(ADAT_LAP);
  lap.getRange('A1:E1').setValues([['Dátum', 'Név', 'Összeg (Ft)', 'Kategória', 'Azonosító']]).setFontWeight('bold');
  lap.setFrozenRows(1);
  lap.getRange('A2:A').setNumberFormat('yyyy.mm.dd hh:mm');
  lap.getRange('B2:B').setNumberFormat('@');
  lap.getRange('C2:C').setNumberFormat('#,##0 "Ft"');
  lap.setColumnWidth(1, 140);
  lap.setColumnWidth(2, 220);
  lap.setColumnWidth(4, 130);
  lap.hideColumns(5);

  const ossz = ss.getSheetByName(OSSZESITO_LAP) || ss.insertSheet(OSSZESITO_LAP);
  ossz.getRange('A1').setValue('Hónap:').setFontWeight('bold');
  ossz.getRange('B1')
    .setFormula('=DATE(YEAR(TODAY()),MONTH(TODAY()),1)')
    .setNumberFormat('yyyy. mmmm')
    .setFontWeight('bold');
  ossz.getRange('C1').setValue('← másik hónaphoz írj ide egy dátumot, pl. 2026.09.01').setFontColor('#6b7280');
  ossz.getRange('A2').setValue('Összesen:').setFontWeight('bold');
  ossz.getRange('B2').setFormula('=SUM(B5:B50)').setNumberFormat('#,##0 "Ft"').setFontWeight('bold');

  ossz.getRange('A4').setFormula(
    '=IFERROR(QUERY(FILTER(\'Kiadások\'!B2:D, \'Kiadások\'!A2:A>=B1, \'Kiadások\'!A2:A<EDATE(B1,1)),' +
    ' "select Col3, sum(Col2) group by Col3 order by sum(Col2) desc label Col3 \'Kategória\', sum(Col2) \'Összeg\'", 0),' +
    ' {"Kategória","Összeg"})'
  );
  ossz.getRange('A4:B4').setFontWeight('bold');
  ossz.getRange('B5:B50').setNumberFormat('#,##0 "Ft"');
  ossz.setColumnWidth(1, 140);
  ossz.setColumnWidth(2, 140);

  const diagram = ossz.newChart()
    .setChartType(Charts.ChartType.PIE)
    .addRange(ossz.getRange('A4:B50'))
    .setNumHeaders(1)
    .setOption('title', 'Mire ment el a pénz ebben a hónapban')
    .setOption('pieHole', 0.4)
    .setOption('legend', { position: 'right' })
    .setPosition(4, 4, 0, 0)
    .build();
  ossz.insertChart(diagram);

  return lap;
}
