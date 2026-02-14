function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Traduccia — Revisió de Traduccions amb IA')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/**
 * Guarda la configuració de la IA al servidor (PropertiesService).
 * Així l'API Key no viatja en cada crida des del client.
 */
function guardarConfig(model, apiKey, proveidor) {
  var props = PropertiesService.getUserProperties();
  props.setProperties({
    'traduccia_model': model,
    'traduccia_apiKey': apiKey,
    'traduccia_proveidor': proveidor
  });
  return true;
}

/**
 * Recupera la configuració guardada (sense retornar l'API Key sencera al client).
 */
function obtenirConfig() {
  var props = PropertiesService.getUserProperties();
  var apiKey = props.getProperty('traduccia_apiKey') || '';
  return {
    model: props.getProperty('traduccia_model') || '',
    proveidor: props.getProperty('traduccia_proveidor') || 'openai',
    apiKeySet: apiKey.length > 0,
    apiKeyPreview: apiKey.length > 4 ? '••••' + apiKey.slice(-4) : ''
  };
}

function revisarCapitol(original, traduccio, model, apiKey, proveidor, glossari) {
  // Fallback a config guardada si no es passen paràmetres
  if (!apiKey || !model) {
    var props = PropertiesService.getUserProperties();
    model = model || props.getProperty('traduccia_model');
    apiKey = apiKey || props.getProperty('traduccia_apiKey');
    proveidor = proveidor || props.getProperty('traduccia_proveidor') || 'openai';
  }

  if (!apiKey || !model) {
    throw new Error('Cal configurar el Model i l\'API Key primer.');
  }

  var prompt = 'Ets un traductor professional expert. A continuació tens el text original i la seva traducció.\n\n';

  if (glossari && glossari.trim() !== '') {
    prompt += 'GLOSSARI DE CONSISTÈNCIA (usa sempre aquests noms i termes):\n' + glossari + '\n\n';
  }

  prompt += 'Revisa la traducció i retorna-la corregida íntegrament.\n';
  prompt += '- Corregeix errors de traducció, gramàtica, estil i coherència.\n';
  prompt += '- Manté la consistència dels noms propis segons el glossari.\n';
  prompt += '- NO afegeixis comentaris ni explicacions.\n';
  prompt += '- Retorna NOMÉS el text traduït corregit, complet, sense omissions.\n\n';
  prompt += '=== TEXT ORIGINAL ===\n' + original + '\n\n';
  prompt += '=== TRADUCCIÓ A REVISAR ===\n' + traduccio + '\n\n';
  prompt += '=== TRADUCCIÓ CORREGIDA ===\n';

  if (proveidor === 'anthropic') {
    return cridaAnthropic(prompt, model, apiKey);
  } else {
    return cridaOpenAI(prompt, model, apiKey);
  }
}

function generarGlossari(original, traduccio, model, apiKey, proveidor) {
  // Fallback a config guardada
  if (!apiKey || !model) {
    var props = PropertiesService.getUserProperties();
    model = model || props.getProperty('traduccia_model');
    apiKey = apiKey || props.getProperty('traduccia_apiKey');
    proveidor = proveidor || props.getProperty('traduccia_proveidor') || 'openai';
  }

  if (!apiKey || !model) {
    throw new Error('Cal configurar el Model i l\'API Key primer.');
  }

  var prompt = 'Analitza els següents textos (original i traducció) i genera un glossari en format de llista amb:\n';
  prompt += '1. PERSONATGES: Nom original → Nom en la traducció\n';
  prompt += '2. LLOCS: Nom original → Nom en la traducció\n';
  prompt += '3. TERMES RECURRENTS: Terme original → Traducció consistent\n\n';
  prompt += 'Retorna NOMÉS el glossari en format estructurat, sense explicacions addicionals.\n\n';
  prompt += '=== TEXT ORIGINAL ===\n' + original + '\n\n';
  prompt += '=== TRADUCCIÓ ===\n' + traduccio + '\n';

  if (proveidor === 'anthropic') {
    return cridaAnthropic(prompt, model, apiKey);
  } else {
    return cridaOpenAI(prompt, model, apiKey);
  }
}

function cridaOpenAI(prompt, model, apiKey) {
  var url = 'https://api.openai.com/v1/chat/completions';
  var payload = {
    model: model,
    messages: [
      {
        role: 'system',
        content: 'Ets un traductor i corrector professional. Segueix les instruccions exactament.'
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 16000,
    temperature: 0.3
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + apiKey },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  // Retry amb backoff exponencial (max 3 intents)
  var maxRetries = 3;
  for (var attempt = 0; attempt < maxRetries; attempt++) {
    try {
      var response = UrlFetchApp.fetch(url, options);
      var code = response.getResponseCode();
      var json = JSON.parse(response.getContentText());

      if (code === 429 || code >= 500) {
        if (attempt < maxRetries - 1) {
          Utilities.sleep(Math.pow(2, attempt) * 2000);
          continue;
        }
        throw new Error('Error ' + code + ': ' + (json.error ? json.error.message : 'Server error'));
      }

      if (json.error) {
        throw new Error(json.error.message);
      }
      return json.choices[0].message.content;
    } catch (e) {
      if (attempt === maxRetries - 1) {
        throw new Error('Error API OpenAI (després de ' + maxRetries + ' intents): ' + e.message);
      }
      Utilities.sleep(Math.pow(2, attempt) * 2000);
    }
  }
}

function cridaAnthropic(prompt, model, apiKey) {
  var url = 'https://api.anthropic.com/v1/messages';
  var payload = {
    model: model,
    max_tokens: 16000,
    system: 'Ets un traductor i corrector professional. Segueix les instruccions exactament.',
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  };
  var options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  // Retry amb backoff exponencial (max 3 intents)
  var maxRetries = 3;
  for (var attempt = 0; attempt < maxRetries; attempt++) {
    try {
      var response = UrlFetchApp.fetch(url, options);
      var code = response.getResponseCode();
      var json = JSON.parse(response.getContentText());

      if (code === 429 || code >= 500) {
        if (attempt < maxRetries - 1) {
          Utilities.sleep(Math.pow(2, attempt) * 2000);
          continue;
        }
        throw new Error('Error ' + code + ': ' + (json.error ? json.error.message : 'Server error'));
      }

      if (json.error) {
        throw new Error(json.error.message);
      }
      return json.content[0].text;
    } catch (e) {
      if (attempt === maxRetries - 1) {
        throw new Error('Error API Anthropic (després de ' + maxRetries + ' intents): ' + e.message);
      }
      Utilities.sleep(Math.pow(2, attempt) * 2000);
    }
  }
}

/**
 * Revisa un capítol llarg dividint-lo en parts si cal.
 * Límit de google.script.run: ~256KB per paràmetre.
 * Límit pràctic per context IA: ~12000 caràcters per secció.
 */
function revisarCapitolLlarg(partsOriginal, partsTraduccio, model, apiKey, proveidor, glossari) {
  // partsOriginal i partsTraduccio són arrays de strings (ja dividits al client)
  if (!apiKey || !model) {
    var props = PropertiesService.getUserProperties();
    model = model || props.getProperty('traduccia_model');
    apiKey = apiKey || props.getProperty('traduccia_apiKey');
    proveidor = proveidor || props.getProperty('traduccia_proveidor') || 'openai';
  }

  if (!apiKey || !model) {
    throw new Error('Cal configurar el Model i l\'API Key primer.');
  }

  var resultats = [];

  for (var i = 0; i < partsOriginal.length; i++) {
    var prompt = 'Ets un traductor professional expert. Estàs revisant la PART ' + (i + 1) + ' de ' + partsOriginal.length + ' d\'un capítol.\n\n';

    if (glossari && glossari.trim() !== '') {
      prompt += 'GLOSSARI DE CONSISTÈNCIA:\n' + glossari + '\n\n';
    }

    prompt += 'Revisa la traducció i retorna-la corregida íntegrament.\n';
    prompt += '- NO afegeixis comentaris ni explicacions.\n';
    prompt += '- Retorna NOMÉS el text traduït corregit d\'aquesta part.\n\n';
    prompt += '=== TEXT ORIGINAL (PART ' + (i + 1) + ') ===\n' + partsOriginal[i] + '\n\n';
    prompt += '=== TRADUCCIÓ A REVISAR (PART ' + (i + 1) + ') ===\n' + partsTraduccio[i] + '\n\n';
    prompt += '=== TRADUCCIÓ CORREGIDA ===\n';

    var resultat;
    if (proveidor === 'anthropic') {
      resultat = cridaAnthropic(prompt, model, apiKey);
    } else {
      resultat = cridaOpenAI(prompt, model, apiKey);
    }
    resultats.push(resultat);
  }

  return resultats.join('\n\n');
}
