/**
 * Grounding text for the OTC "Before you buy" sheet.
 *
 * SOURCES holds the retrieved source text, keyed by salt identity (no strength,
 * no brand). In production these rows come from ingest_drug_info.py, which
 * pulls the openFDA drug-label API and MedlinePlus. Here they are checked-in
 * reference extracts so the demo needs no network and no quota.
 *
 * PREBAKED holds reviewed, pre-generated summaries per language, so the sheet
 * opens instantly and the demo spends no LLM quota. Anything missing falls
 * back to the English source bullets with a translation notice.
 *
 * Hard rule everywhere below: no dose, no frequency, no "how much to take".
 */

export interface DrugInfoSourceText {
  indications: string
  adverse_reactions: string
  warnings: string
  stop_use: string
}

export interface DrugInfoSource {
  salt_key: string
  display_name: string
  source_text: DrugInfoSourceText
  source_urls: string[]
}

export interface DrugInfoContent {
  common_uses: string[]
  common_side_effects: string[]
  seek_help_if: string[]
  who_should_be_careful: string[]
  source_ids: string[]
}

const OPENFDA = 'https://open.fda.gov/apis/drug/label/'
const MEDLINE = 'https://medlineplus.gov/druginformation.html'

export const SOURCES: DrugInfoSource[] = [
  {
    salt_key: 'paracetamol',
    display_name: 'Paracetamol (acetaminophen)',
    source_text: {
      indications:
        'For the temporary relief of minor aches and pains and for the reduction of fever.',
      adverse_reactions:
        'Nausea, stomach discomfort and skin rash are reported. Serious skin reactions and allergic reactions are uncommon but possible.',
      warnings:
        'Contains acetaminophen. Severe liver damage may occur if more than the labelled amount is taken, if taken with other medicines containing acetaminophen, or if taken with alcohol. Ask a doctor before use if you have liver disease.',
      stop_use:
        'Stop use and ask a doctor if a skin reaction such as redness, blisters or rash appears, if pain or fever gets worse or lasts more than a few days, or if new symptoms appear.',
    },
    source_urls: [`${OPENFDA}`, 'https://medlineplus.gov/druginfo/meds/a681004.html'],
  },
  {
    salt_key: 'caffeine+paracetamol',
    display_name: 'Paracetamol with caffeine',
    source_text: {
      indications:
        'For the temporary relief of minor aches and pains, including headache. Caffeine is included to increase the pain-relieving effect of the analgesic.',
      adverse_reactions:
        'Nausea, nervousness, restlessness, difficulty sleeping and a faster heartbeat are reported with the caffeine component.',
      warnings:
        'Contains acetaminophen and caffeine. Limit other sources of caffeine such as tea, coffee and cola while taking this product. Severe liver damage may occur if more than the labelled amount of acetaminophen is taken or if it is taken with alcohol.',
      stop_use:
        'Stop use and ask a doctor if nervousness, sleeplessness or a rapid heartbeat occurs, if a skin reaction appears, or if pain lasts more than a few days.',
    },
    source_urls: [`${OPENFDA}`, MEDLINE],
  },
  {
    salt_key: 'ibuprofen',
    display_name: 'Ibuprofen',
    source_text: {
      indications:
        'For the temporary relief of minor aches and pains due to headache, toothache, backache, muscular aches, menstrual cramps and minor pain of arthritis, and for reduction of fever.',
      adverse_reactions:
        'Stomach pain, heartburn, nausea and dizziness are common. Stomach bleeding and ulcers can occur, sometimes without warning.',
      warnings:
        'Contains a nonsteroidal anti-inflammatory drug. Risk of severe stomach bleeding is higher in people over 60, people who have had stomach ulcers or bleeding, people taking blood thinners or steroids, and people who drink alcohol. May cause kidney problems and raise blood pressure. Ask a doctor before use if you have heart disease, high blood pressure, kidney disease, asthma or are pregnant.',
      stop_use:
        'Stop use and ask a doctor if you have stomach pain that does not go away, vomit blood, pass black or bloody stools, have swelling of the face or difficulty breathing, or if pain or fever lasts longer than a few days.',
    },
    source_urls: [`${OPENFDA}`, 'https://medlineplus.gov/druginfo/meds/a682159.html'],
  },
  {
    salt_key: 'ibuprofen+paracetamol',
    display_name: 'Ibuprofen with paracetamol',
    source_text: {
      indications:
        'For the temporary relief of minor aches, pains and fever, combining an anti-inflammatory pain reliever with a fever reducer.',
      adverse_reactions:
        'Stomach pain, heartburn, nausea and dizziness are reported. Stomach bleeding and ulcers can occur with the anti-inflammatory component.',
      warnings:
        'Contains both a nonsteroidal anti-inflammatory drug and acetaminophen. Do not take other products containing either ingredient at the same time. Risk of stomach bleeding is higher with alcohol, blood thinners, steroids or a past ulcer. Ask a doctor before use if you have heart, kidney or liver disease, high blood pressure or asthma.',
      stop_use:
        'Stop use and ask a doctor if stomach pain persists, if you notice blood in vomit or stools, if a skin rash or facial swelling appears, or if symptoms last more than a few days.',
    },
    source_urls: [`${OPENFDA}`, MEDLINE],
  },
  {
    salt_key: 'cetirizine',
    display_name: 'Cetirizine',
    source_text: {
      indications:
        'Temporarily relieves symptoms due to hay fever or other upper respiratory allergies: runny nose, sneezing, itchy and watery eyes, and itching of the nose or throat. Also used for hives.',
      adverse_reactions:
        'Drowsiness, tiredness, dry mouth and headache are common. Drowsiness is more likely at higher than labelled amounts.',
      warnings:
        'May cause drowsiness; be careful when driving or operating machinery, and avoid alcohol and other sedatives. Ask a doctor before use if you have liver or kidney disease, or if you are pregnant or breastfeeding.',
      stop_use:
        'Stop use and ask a doctor if an allergic reaction occurs, if hives are accompanied by difficulty breathing or swallowing or swelling of the tongue, or if symptoms do not improve within a few days.',
    },
    source_urls: [`${OPENFDA}`, 'https://medlineplus.gov/druginfo/meds/a698026.html'],
  },
  {
    salt_key: 'levocetirizine',
    display_name: 'Levocetirizine',
    source_text: {
      indications:
        'Relieves symptoms of allergic rhinitis such as sneezing, runny nose, itchy eyes and nasal itching, and relieves itching due to chronic hives.',
      adverse_reactions:
        'Sleepiness, tiredness, dry mouth and nasal irritation are reported. Children may show fever or cough.',
      warnings:
        'May cause sleepiness; avoid driving or operating machinery until you know how it affects you, and avoid alcohol. Ask a doctor before use if you have kidney disease, are pregnant or are breastfeeding.',
      stop_use:
        'Stop use and ask a doctor if you have difficulty passing urine, if an allergic reaction occurs, or if symptoms do not improve.',
    },
    source_urls: [`${OPENFDA}`, 'https://medlineplus.gov/druginfo/meds/a607056.html'],
  },
  {
    salt_key: 'chlorpheniramine+dextromethorphan',
    display_name: 'Dextromethorphan with chlorpheniramine',
    source_text: {
      indications:
        'Temporarily relieves cough due to minor throat and bronchial irritation, along with sneezing, runny nose and watery eyes due to the common cold or allergy.',
      adverse_reactions:
        'Marked drowsiness, dizziness, dry mouth, nose and throat, blurred vision and excitability in children are reported.',
      warnings:
        'May cause marked drowsiness; alcohol, sedatives and tranquillisers increase this. Be careful when driving or operating machinery. Do not use for a persistent or chronic cough such as occurs with smoking, asthma or emphysema. Ask a doctor before use if you have glaucoma, a breathing problem, an enlarged prostate or difficulty passing urine.',
      stop_use:
        'Stop use and ask a doctor if the cough lasts more than seven days, comes back, or is accompanied by fever, rash or a persistent headache.',
    },
    source_urls: [`${OPENFDA}`, MEDLINE],
  },
  {
    salt_key: 'ambroxol',
    display_name: 'Ambroxol',
    source_text: {
      indications:
        'Used as a mucolytic to loosen thick mucus in the airways so that a productive cough clears more easily, in respiratory conditions with excess sticky secretions.',
      adverse_reactions:
        'Nausea, altered taste, mouth or throat numbness, stomach upset and diarrhoea are reported. Allergic skin reactions are uncommon.',
      warnings:
        'Ask a doctor before use if you have a stomach ulcer, impaired kidney or liver function, or if you are pregnant or breastfeeding. Severe skin reactions have been reported rarely.',
      stop_use:
        'Stop use and see a doctor if a skin rash, blistering or swelling of the face or throat appears, or if the cough does not improve within a few days.',
    },
    source_urls: ['https://medlineplus.gov/druginformation.html'],
  },
  {
    salt_key: 'cholecalciferol',
    display_name: 'Vitamin D3 (cholecalciferol)',
    source_text: {
      indications:
        'A dietary supplement used to prevent and treat vitamin D deficiency, and to support calcium absorption for bone health.',
      adverse_reactions:
        'At excessive intake, nausea, vomiting, weakness, frequent urination, constipation and raised blood calcium can occur.',
      warnings:
        'Too much vitamin D can be harmful. Ask a doctor before use if you have kidney disease, high blood calcium, sarcoidosis or are taking other supplements containing vitamin D or calcium. Blood levels should be checked by a doctor rather than guessed.',
      stop_use:
        'Stop use and see a doctor if you have persistent nausea or vomiting, weakness, confusion, bone pain or a large increase in thirst and urination.',
    },
    source_urls: [`${OPENFDA}`, 'https://medlineplus.gov/druginfo/meds/a682058.html'],
  },
  {
    salt_key: 'calcium carbonate+cholecalciferol',
    display_name: 'Calcium carbonate with vitamin D3',
    source_text: {
      indications:
        'A dietary supplement used to support bone health where dietary calcium and vitamin D are insufficient, including in osteoporosis management under medical advice.',
      adverse_reactions: 'Constipation, gas, bloating and stomach upset are common.',
      warnings:
        'Ask a doctor before use if you have kidney stones, kidney disease, high blood calcium or parathyroid disease. Calcium can reduce the absorption of some medicines, including thyroid medicines and some antibiotics, so spacing them apart matters — ask your pharmacist.',
      stop_use:
        'Stop use and see a doctor if you have severe constipation, stomach pain, nausea and vomiting, or symptoms of a kidney stone such as pain in the side and blood in the urine.',
    },
    source_urls: [`${OPENFDA}`, MEDLINE],
  },
  {
    salt_key: 'ferrous ascorbate+folic acid',
    display_name: 'Iron with folic acid',
    source_text: {
      indications:
        'A supplement used to prevent and treat iron-deficiency anaemia and folate deficiency, including during pregnancy under medical advice.',
      adverse_reactions:
        'Constipation, dark or black stools, nausea, stomach cramps and a metallic taste are common. Dark stools are expected and harmless.',
      warnings:
        'Accidental overdose of iron-containing products is a leading cause of fatal poisoning in children under six; keep out of reach of children. Ask a doctor before use if you have a condition that causes iron overload, a stomach ulcer or inflammatory bowel disease. Tea, coffee, calcium and antacids reduce iron absorption.',
      stop_use:
        'Stop use and see a doctor if you have severe stomach pain, vomiting, blood in the stool, or if tiredness does not improve after the course your doctor advised.',
    },
    source_urls: [`${OPENFDA}`, 'https://medlineplus.gov/druginfo/meds/a682778.html'],
  },
  {
    salt_key: 'povidone iodine',
    display_name: 'Povidone-iodine',
    source_text: {
      indications:
        'A first-aid antiseptic applied to the skin to help prevent infection in minor cuts, scrapes and burns.',
      adverse_reactions:
        'Skin irritation, redness, itching and staining of the skin are reported. Allergic skin reactions are uncommon.',
      warnings:
        'For external use only. Do not use in the eyes, over large areas of the body, on deep or puncture wounds, serious burns or animal bites. Ask a doctor before use if you have a thyroid disorder or are allergic to iodine. Do not bandage tightly.',
      stop_use:
        'Stop use and ask a doctor if the condition worsens, if redness, swelling or discharge increases, or if it does not improve within seven days.',
    },
    source_urls: [`${OPENFDA}`, MEDLINE],
  },
  {
    salt_key: 'clotrimazole',
    display_name: 'Clotrimazole',
    source_text: {
      indications:
        'An antifungal cream used on the skin to treat athlete’s foot, jock itch, ringworm and other fungal skin infections.',
      adverse_reactions:
        'Burning, stinging, redness, peeling and itching at the application site are reported.',
      warnings:
        'For external use only. Do not use in the eyes. Ask a doctor before use for a child under two years, or for infections on the scalp or nails, which need a doctor.',
      stop_use:
        'Stop use and ask a doctor if irritation occurs or gets worse, or if there is no improvement within four weeks for athlete’s foot or two weeks for other fungal skin infections.',
    },
    source_urls: [`${OPENFDA}`, 'https://medlineplus.gov/druginfo/meds/a684035.html'],
  },
]

/** Reviewed pre-generated content. Keyed `${salt_key}::${language}`. */
export const PREBAKED: Record<string, DrugInfoContent> = {
  'paracetamol::en': {
    common_uses: ['Brings down fever', 'Eases mild pain like headache or body ache'],
    common_side_effects: ['Upset stomach or nausea in some people', 'Skin rash, rarely'],
    seek_help_if: [
      'Your fever or pain lasts more than a few days or gets worse',
      'You get a skin rash, blisters or redness',
      'You have taken more than the amount on the pack',
    ],
    who_should_be_careful: [
      'People with liver disease',
      'People who drink alcohol',
      'Anyone already taking another medicine that contains paracetamol',
    ],
    source_ids: ['paracetamol'],
  },
  'paracetamol::hi': {
    common_uses: ['बुखार कम करता है', 'सिर दर्द या शरीर दर्द में आराम देता है'],
    common_side_effects: ['कुछ लोगों को पेट खराब या जी मिचलाना', 'कभी-कभार त्वचा पर दाने'],
    seek_help_if: [
      'बुखार या दर्द कुछ दिनों से ज़्यादा रहे या बढ़े',
      'त्वचा पर दाने, छाले या लाली हो',
      'आपने पैकेट पर लिखी मात्रा से ज़्यादा ले लिया हो',
    ],
    who_should_be_careful: [
      'जिगर (लिवर) की बीमारी वाले लोग',
      'शराब पीने वाले लोग',
      'जो पहले से पैरासिटामोल वाली कोई दूसरी दवा ले रहे हैं',
    ],
    source_ids: ['paracetamol'],
  },
  'paracetamol::mr': {
    common_uses: ['ताप कमी करते', 'डोकेदुखी किंवा अंगदुखीत आराम देते'],
    common_side_effects: ['काहींना पोट बिघडणे किंवा मळमळ', 'क्वचित त्वचेवर पुरळ'],
    seek_help_if: [
      'ताप किंवा दुखणे काही दिवसांपेक्षा जास्त राहिले किंवा वाढले',
      'त्वचेवर पुरळ, फोड किंवा लालसरपणा आला',
      'पाकिटावर लिहिलेल्या प्रमाणापेक्षा जास्त घेतले',
    ],
    who_should_be_careful: [
      'यकृताचा आजार असलेले',
      'दारू पिणारे',
      'आधीच पॅरासिटामॉल असलेले दुसरे औषध घेणारे',
    ],
    source_ids: ['paracetamol'],
  },
  'cetirizine::en': {
    common_uses: [
      'Relieves sneezing, runny nose and itchy, watery eyes from allergy',
      'Relieves itching from hives',
    ],
    common_side_effects: ['Sleepiness', 'Tiredness', 'Dry mouth', 'Headache'],
    seek_help_if: [
      'Hives come with trouble breathing or swallowing, or a swollen tongue',
      'Your symptoms do not get better in a few days',
      'You have an allergic reaction to the medicine itself',
    ],
    who_should_be_careful: [
      'Anyone who has to drive or operate machinery',
      'People with liver or kidney disease',
      'Pregnant or breastfeeding women',
    ],
    source_ids: ['cetirizine'],
  },
  'cetirizine::hi': {
    common_uses: [
      'एलर्जी से छींक, बहती नाक और आँखों की खुजली-पानी में आराम',
      'पित्ती (हाइव्स) की खुजली में आराम',
    ],
    common_side_effects: ['नींद आना', 'थकान', 'मुँह सूखना', 'सिर दर्द'],
    seek_help_if: [
      'पित्ती के साथ साँस लेने या निगलने में दिक्कत हो, या जीभ सूज जाए',
      'कुछ दिनों में तकलीफ़ कम न हो',
      'दवा से ही एलर्जी जैसा असर हो',
    ],
    who_should_be_careful: [
      'जिन्हें गाड़ी या मशीन चलानी है',
      'जिगर या गुर्दे की बीमारी वाले लोग',
      'गर्भवती या स्तनपान कराने वाली महिलाएँ',
    ],
    source_ids: ['cetirizine'],
  },
  'cetirizine::mr': {
    common_uses: [
      'ॲलर्जीमुळे होणाऱ्या शिंका, वाहणारे नाक आणि डोळ्यांची खाज-पाणी यात आराम',
      'अंगावर उठणाऱ्या पित्ताच्या खाजेत आराम',
    ],
    common_side_effects: ['झोप येणे', 'थकवा', 'तोंड कोरडे पडणे', 'डोकेदुखी'],
    seek_help_if: [
      'पित्तासोबत श्वास घ्यायला किंवा गिळायला त्रास होत असेल, किंवा जीभ सुजली असेल',
      'काही दिवसांत त्रास कमी झाला नाही',
      'औषधाचीच ॲलर्जी झाल्यासारखे वाटले',
    ],
    who_should_be_careful: [
      'गाडी किंवा यंत्र चालवणारे',
      'यकृत किंवा मूत्रपिंडाचा आजार असलेले',
      'गरोदर किंवा स्तनपान करणाऱ्या महिला',
    ],
    source_ids: ['cetirizine'],
  },
  'ibuprofen+paracetamol::en': {
    common_uses: ['Eases pain such as body ache, toothache or period pain', 'Brings down fever'],
    common_side_effects: ['Stomach pain or heartburn', 'Nausea', 'Dizziness'],
    seek_help_if: [
      'You have stomach pain that does not go away',
      'You see blood in your vomit, or black or bloody stools',
      'Your face swells or you find it hard to breathe',
    ],
    who_should_be_careful: [
      'People who have had a stomach ulcer or bleeding',
      'People with heart, kidney or liver disease, or high blood pressure',
      'People on blood thinners or steroids, and people who drink alcohol',
    ],
    source_ids: ['ibuprofen+paracetamol'],
  },
  'ibuprofen+paracetamol::hi': {
    common_uses: ['शरीर दर्द, दाँत दर्द या माहवारी के दर्द में आराम', 'बुखार कम करता है'],
    common_side_effects: ['पेट में दर्द या जलन', 'जी मिचलाना', 'चक्कर आना'],
    seek_help_if: [
      'पेट का दर्द ठीक न हो',
      'उल्टी में खून आए, या काला/खून वाला मल हो',
      'चेहरा सूज जाए या साँस लेने में दिक्कत हो',
    ],
    who_should_be_careful: [
      'जिन्हें पेट का अल्सर या खून बहने की शिकायत रही हो',
      'दिल, गुर्दे या जिगर की बीमारी, या हाई ब्लड प्रेशर वाले लोग',
      'खून पतला करने की दवा या स्टेरॉइड लेने वाले, और शराब पीने वाले',
    ],
    source_ids: ['ibuprofen+paracetamol'],
  },
  'povidone iodine::en': {
    common_uses: ['Antiseptic for minor cuts, scrapes and burns', 'Helps prevent skin infection'],
    common_side_effects: ['Skin irritation or redness', 'Itching', 'Staining of the skin'],
    seek_help_if: [
      'Redness, swelling or discharge gets worse',
      'The wound does not improve within a week',
      'You get a rash or swelling after using it',
    ],
    who_should_be_careful: [
      'People with a thyroid problem',
      'People allergic to iodine',
      'Anyone with a deep wound, serious burn or animal bite — that needs a doctor',
    ],
    source_ids: ['povidone iodine'],
  },
  'povidone iodine::hi': {
    common_uses: ['छोटे कट, छिलने और जलने पर एंटीसेप्टिक', 'त्वचा के संक्रमण से बचाव में मदद'],
    common_side_effects: ['त्वचा में जलन या लाली', 'खुजली', 'त्वचा पर दाग'],
    seek_help_if: [
      'लाली, सूजन या पीप बढ़ जाए',
      'एक हफ़्ते में घाव ठीक न हो',
      'लगाने के बाद दाने या सूजन हो',
    ],
    who_should_be_careful: [
      'थायरॉइड की शिकायत वाले लोग',
      'आयोडीन से एलर्जी वाले लोग',
      'गहरा घाव, गंभीर जलन या जानवर के काटने पर — डॉक्टर के पास जाएँ',
    ],
    source_ids: ['povidone iodine'],
  },
  'cholecalciferol::en': {
    common_uses: ['Treats and prevents vitamin D deficiency', 'Helps the body absorb calcium for bones'],
    common_side_effects: ['Usually none at the amount on the pack', 'Nausea or constipation in some people'],
    seek_help_if: [
      'You feel very weak, confused or keep vomiting',
      'You are unusually thirsty and passing a lot of urine',
      'You have bone pain that is getting worse',
    ],
    who_should_be_careful: [
      'People with kidney disease or kidney stones',
      'People with high blood calcium',
      'Anyone already taking another vitamin D or calcium supplement',
    ],
    source_ids: ['cholecalciferol'],
  },
  'cholecalciferol::hi': {
    common_uses: ['विटामिन डी की कमी का इलाज और बचाव', 'हड्डियों के लिए कैल्शियम सोखने में मदद'],
    common_side_effects: ['पैकेट पर लिखी मात्रा पर आमतौर पर कुछ नहीं', 'कुछ लोगों को जी मिचलाना या कब्ज़'],
    seek_help_if: [
      'बहुत कमज़ोरी, उलझन या बार-बार उल्टी हो',
      'बहुत प्यास लगे और बार-बार पेशाब आए',
      'हड्डियों का दर्द बढ़ता जाए',
    ],
    who_should_be_careful: [
      'गुर्दे की बीमारी या पथरी वाले लोग',
      'खून में कैल्शियम ज़्यादा होने वाले लोग',
      'जो पहले से विटामिन डी या कैल्शियम का कोई सप्लीमेंट ले रहे हैं',
    ],
    source_ids: ['cholecalciferol'],
  },
  'ibuprofen::en': {
    common_uses: ['Eases pain and swelling', 'Brings down fever'],
    common_side_effects: ['Stomach pain or heartburn', 'Nausea', 'Dizziness'],
    seek_help_if: [
      'Stomach pain does not go away',
      'You see blood in vomit or black stools',
      'Your face swells or breathing becomes difficult',
    ],
    who_should_be_careful: [
      'People over 60, and anyone with a past stomach ulcer',
      'People with heart, kidney or liver disease, or high blood pressure',
      'Pregnant women, and people with asthma',
    ],
    source_ids: ['ibuprofen'],
  },
  'ibuprofen::hi': {
    common_uses: ['दर्द और सूजन में आराम', 'बुखार कम करता है'],
    common_side_effects: ['पेट में दर्द या जलन', 'जी मिचलाना', 'चक्कर आना'],
    seek_help_if: [
      'पेट का दर्द ठीक न हो',
      'उल्टी में खून या काला मल दिखे',
      'चेहरा सूजे या साँस लेने में दिक्कत हो',
    ],
    who_should_be_careful: [
      '60 साल से ऊपर के लोग, और जिन्हें पेट का अल्सर रहा हो',
      'दिल, गुर्दे या जिगर की बीमारी, या हाई ब्लड प्रेशर वाले लोग',
      'गर्भवती महिलाएँ और दमा (अस्थमा) वाले लोग',
    ],
    source_ids: ['ibuprofen'],
  },
  'clotrimazole::en': {
    common_uses: ['Treats fungal skin infections such as ringworm, athlete’s foot and jock itch'],
    common_side_effects: ['Burning or stinging where it is applied', 'Redness or peeling', 'Itching'],
    seek_help_if: [
      'Irritation gets worse after using it',
      'There is no improvement in two to four weeks',
      'The infection is on the scalp or nails — that needs a doctor',
    ],
    who_should_be_careful: [
      'Children under two years',
      'Anyone applying it near the eyes — do not',
      'People whose infection keeps coming back',
    ],
    source_ids: ['clotrimazole'],
  },
  'clotrimazole::hi': {
    common_uses: ['दाद, पैरों की फंगस और जाँघ की फंगस जैसे त्वचा के संक्रमण का इलाज'],
    common_side_effects: ['लगाने की जगह जलन या चुभन', 'लाली या पपड़ी', 'खुजली'],
    seek_help_if: [
      'लगाने के बाद जलन बढ़ जाए',
      'दो से चार हफ़्ते में फ़ायदा न हो',
      'संक्रमण सिर की त्वचा या नाखून पर हो — डॉक्टर को दिखाएँ',
    ],
    who_should_be_careful: [
      'दो साल से छोटे बच्चे',
      'आँखों के पास न लगाएँ',
      'जिन्हें संक्रमण बार-बार हो रहा है',
    ],
    source_ids: ['clotrimazole'],
  },
}
