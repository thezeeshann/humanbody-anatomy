// Side-panel content for the interactive anatomy mannequin.
// Facts are drawn from innerbody.com (see each entry's `source`), with gaps
// filled from standard textbook anatomy (Gray's Anatomy, OpenStax A&P).

export interface Region {
  title: string;
  system: string;
  color: string;
  summary: string;
  how: string[];
  parts: string[];
  facts: [label: string, value: string][];
  source: string;
  // A female version replaces any of these fields when the female body is shown.
  female?: Partial<Omit<Region, "female">>;
}

export const CONTENT: Record<string, Region> = {
  head: {
    title: "Head & Brain",
    system: "Nervous · Skeletal",
    color: "teal",
    summary:
      "The head holds the brain, the body's control centre, inside a protective case of fused skull bones. It also houses most of the special senses: sight, hearing, balance, smell and taste.",
    how: [
      "The brain weighs about 1.4 kg (3 lb) and is wrapped in three membranes, the meninges, and cushioned by cerebrospinal fluid.",
      "The wrinkled cerebrum handles thought, language, memory and voluntary movement. The cerebellum underneath fine-tunes balance and coordination, and the brainstem keeps breathing and heart rate running without you thinking about it.",
      "Twelve pairs of cranial nerves leave the brain directly. They carry signals from the eyes, ears, nose and tongue, and drive the muscles of the face, jaw and eyes.",
      "In the eye, rods in the retina work in dim light and cones pick out colour and detail. In the ear, three tiny bones pass vibrations from the eardrum to the cochlea, which turns sound into nerve signals.",
    ],
    parts: [
      "Cerebrum — thinking, memory, language, voluntary movement",
      "Cerebellum — balance, posture and coordination",
      "Brainstem — breathing, heart rate, alertness",
      "Skull — fused bones; only the jaw moves",
      "Eyes — retina with rods and cones",
      "Ears — ossicles, cochlea and balance organs",
    ],
    facts: [
      ["Skull bones", "22 (8 cranial, 14 facial)"],
      ["Brain weight", "About 1.4 kg (3 lb)"],
      ["Cranial nerves", "12 pairs"],
      ["Energy use", "Up to 20% of the body's oxygen and glucose"],
    ],
    source: "https://www.innerbody.com/image/nerv02.html",
  },

  neck: {
    title: "Neck & Throat",
    system: "Skeletal · Respiratory · Digestive · Endocrine",
    color: "cream",
    summary:
      "The neck is a busy passage linking the head to the trunk. Seven small vertebrae hold the head up while the airway, food pipe, major blood vessels and the thyroid gland all pass through or sit within it.",
    how: [
      "The seven cervical vertebrae are the smallest in the spine but give the neck great mobility. The top one, the atlas, lets you nod; the second, the axis, lets you turn your head side to side.",
      "Air passes from the throat through the larynx (voice box) into the trachea. Exhaled air makes the vocal folds vibrate, and small muscles change their tension to set the pitch of your voice.",
      "When you swallow, the epiglottis folds over the airway so food slides into the esophagus and on to the stomach.",
      "The butterfly-shaped thyroid wraps around the front of the trachea. Its hormones, T3 and T4, set the pace of the body's metabolism.",
    ],
    parts: [
      "Cervical spine — 7 vertebrae, C1 to C7",
      "Larynx — voice box with the vocal folds",
      "Epiglottis — lid that guards the airway when swallowing",
      "Trachea — windpipe held open by C-shaped cartilage rings",
      "Esophagus — muscular food tube behind the trachea",
      "Thyroid gland — hormones that control metabolism",
    ],
    facts: [
      ["Neck vertebrae", "7"],
      ["Larynx", "9 pieces of cartilage"],
      ["Trachea length", "About 12 cm (5 in)"],
      ["Parathyroid glands", "4, behind the thyroid"],
    ],
    source: "https://www.innerbody.com/image/skel05.html",
  },

  chest: {
    title: "Chest & Lungs",
    system: "Respiratory · Skeletal",
    color: "orange",
    summary:
      "The chest is a flexible cage of ribs that shields the heart and lungs. Inside, the two lungs bring in oxygen and get rid of carbon dioxide with every breath.",
    how: [
      "Breathing works by changing the size of the chest. When the dome-shaped diaphragm contracts and flattens, and the muscles between the ribs lift the ribcage, pressure inside the lungs drops and air rushes in.",
      "Breathing out at rest is mostly passive: the muscles relax, the elastic lungs recoil, and air flows back out.",
      "Air travels down the trachea into two bronchi, then through ever-smaller bronchioles to tiny air sacs called alveoli. Their walls are so thin that oxygen slips straight into the surrounding capillaries while carbon dioxide moves the other way.",
      "A slippery double membrane, the pleura, surrounds each lung so it can glide against the chest wall as you breathe.",
    ],
    parts: [
      "Ribs — 12 pairs forming the ribcage",
      "Sternum — the flat breastbone at the front",
      "Lungs — right has 3 lobes, left has 2",
      "Bronchi and bronchioles — branching airways",
      "Alveoli — air sacs where gas exchange happens",
      "Diaphragm — main breathing muscle",
    ],
    facts: [
      ["Ribs", "12 pairs (7 true, 3 false, 2 floating)"],
      ["Lung lobes", "3 right, 2 left"],
      ["Air per quiet breath", "About 0.5 litres"],
      ["Resting breathing rate", "About 12–20 breaths a minute"],
    ],
    source: "https://www.innerbody.com/anatomy/respiratory/lungs",
    // Shown when the female body is selected.
    female: {
      title: "Chest, Lungs & Breasts",
      system: "Respiratory · Skeletal · Reproductive",
      summary:
        "The chest is a flexible cage of ribs that shields the heart and lungs, which bring in oxygen and get rid of carbon dioxide with every breath. On the front of the chest wall sit the two breasts, which hold the milk-producing mammary glands.",
      how: [
        "Breathing works by changing the size of the chest. When the dome-shaped diaphragm contracts and flattens, and the muscles between the ribs lift the ribcage, pressure inside the lungs drops and air rushes in. Breathing out at rest is mostly passive: the elastic lungs recoil and air flows back out.",
        "Air travels down the trachea into two bronchi, then through ever-smaller bronchioles to tiny air sacs called alveoli, where oxygen slips into the blood and carbon dioxide moves the other way.",
        "Each breast sits on the pectoralis major muscle. It is mostly fat, which gives it its size and shape, around 15 to 20 lobes of mammary gland arranged like the spokes of a wheel, and bands of connective tissue that hold it up.",
        "The mammary glands are modified sweat glands. During pregnancy, hormones make them grow; after birth, the hormone prolactin starts milk production in the lobes, and oxytocin squeezes the milk along the lactiferous ducts to openings in the nipple.",
      ],
      parts: [
        "Ribs and sternum — the protective cage",
        "Lungs — right has 3 lobes, left has 2",
        "Bronchi and alveoli — airways and air sacs",
        "Breasts — fat, gland and supporting tissue",
        "Mammary lobes — 15 to 20 per breast, where milk is made",
        "Lactiferous ducts, nipple and areola — carry and release milk",
      ],
      facts: [
        ["Ribs", "12 pairs (7 true, 3 false, 2 floating)"],
        ["Lung lobes", "3 right, 2 left"],
        ["Mammary lobes", "15–20 per breast"],
        ["Air per quiet breath", "About 0.5 litres"],
      ],
      source: "https://www.innerbody.com/image/repo03.html",
    },
  },

  heart: {
    title: "Heart & Circulation",
    system: "Cardiovascular",
    color: "red",
    summary:
      "The heart is a muscular pump about the size of a closed fist, sitting behind the breastbone and tilted to the left. It drives blood through a closed loop of vessels that reaches every cell in the body.",
    how: [
      "The heart is really two pumps side by side. The right side sends oxygen-poor blood to the lungs; the left side, with its thicker wall, pushes oxygen-rich blood out through the aorta to the rest of the body.",
      "Each beat starts at the sinoatrial (SA) node, the heart's natural pacemaker. The electrical signal spreads across the atria, pauses at the AV node, then races down to make the ventricles squeeze.",
      "Four one-way valves stop blood from flowing backwards. Their closing makes the familiar 'lub-dub' sound.",
      "Arteries carry blood away from the heart, capillaries swap oxygen, nutrients and waste with the tissues, and veins bring blood back at low pressure.",
    ],
    parts: [
      "Atria — two upper chambers that receive blood",
      "Ventricles — two lower chambers that pump it out",
      "Tricuspid and mitral valves — between atria and ventricles",
      "Pulmonary and aortic valves — at the exits",
      "SA node — the built-in pacemaker",
      "Aorta — the body's largest artery",
    ],
    facts: [
      ["Chambers", "4"],
      ["Resting heart rate", "About 60–100 beats a minute"],
      ["Output at rest", "About 5 litres a minute"],
      ["Blood in the body", "About 4–5 litres"],
    ],
    source: "https://www.innerbody.com/image/card01.html",
  },

  abdomen: {
    title: "Abdomen & Digestion",
    system: "Digestive · Urinary",
    color: "gold",
    summary:
      "The abdomen holds most of the digestive tract along with the liver, pancreas and kidneys. Together they break food down, absorb nutrients, and clean waste from the blood.",
    how: [
      "The stomach churns food with acid and the enzyme pepsin, turning it into a thick liquid called chyme, then releases it a little at a time through the pyloric sphincter.",
      "Most digestion and absorption happens in the small intestine. Bile from the liver breaks up fats, pancreatic juice digests proteins, fats and carbohydrates, and the folded lining soaks up the results.",
      "The large intestine reclaims water and some vitamins, and its gut bacteria help break down what is left before it leaves as waste.",
      "Behind the gut, the two kidneys filter the blood through about a million tiny nephrons each, keeping what the body needs and sending the rest down to the bladder as urine.",
    ],
    parts: [
      "Stomach — stores and churns food with acid",
      "Liver — makes bile, stores glycogen, clears toxins",
      "Pancreas — digestive enzymes and insulin",
      "Small intestine — main site of absorption",
      "Large intestine — absorbs water, forms stool",
      "Kidneys — filter blood and make urine",
    ],
    facts: [
      ["Small intestine", "About 3 m (10 ft) long"],
      ["Large intestine", "About 1.5 m (5 ft) long"],
      ["Liver weight", "About 1.4 kg (3 lb)"],
      ["Nephrons", "About 1 million per kidney"],
    ],
    source: "https://www.innerbody.com/image/digeov.html",
  },

  pelvis: {
    title: "Pelvis",
    system: "Skeletal · Urinary · Reproductive",
    color: "slate",
    summary:
      "The pelvis is a sturdy bowl of bone at the base of the spine. It carries the weight of the upper body down to the legs and cradles the bladder, the lower bowel and the reproductive organs.",
    how: [
      "Each hip bone forms from three bones (the ilium, ischium and pubis) that fuse together during the teenage years. The two hip bones join the sacrum at the back and meet each other at the front at the pubic symphysis.",
      "The female pelvis is wider and roomier than the male pelvis, with a more flexible pubic symphysis, making room for childbirth.",
      "The bladder is a stretchy muscular bag. As it fills, stretch sensors signal the urge to go; then its wall contracts while the outer sphincter, which you control, relaxes.",
      "In the male body it also holds the prostate, a walnut-sized gland under the bladder that adds fluid to semen, and the two deferent ducts that carry sperm up from the testes.",
    ],
    parts: [
      "Hip bones — ilium, ischium and pubis fused",
      "Sacrum and coccyx — base of the spine and tailbone",
      "Pubic symphysis — cartilage joint at the front",
      "Urinary bladder — stores urine",
      "Prostate — gland below the bladder",
      "Deferent ducts and seminal vesicles — carry and add to sperm",
    ],
    facts: [
      ["Bones fused in each hip bone", "3"],
      ["Bladder capacity", "About 600–800 mL at most"],
      ["Urge to urinate", "Around 150–400 mL"],
      ["Spinal bones in the pelvis", "Sacrum (5 fused) and coccyx"],
    ],
    source: "https://www.innerbody.com/image_diagram/skel18.html",
    // Shown when the female body is selected.
    female: {
      title: "Pelvis & Reproductive Organs",
      system: "Skeletal · Urinary · Reproductive",
      summary:
        "The female pelvis is a wide bowl of bone at the base of the spine. It carries the weight of the upper body to the legs and holds the bladder, the lower bowel and the reproductive organs: the uterus, the two ovaries and the fallopian tubes.",
      how: [
        "Each hip bone forms from three bones (the ilium, ischium and pubis) that fuse during the teenage years. The female pelvis is wider and shallower than the male pelvis, with a rounder opening and a wider angle under the pubic bones, which makes room for a baby's head during birth.",
        "The ovaries are two almond-sized glands on either side of the uterus. They hold the eggs and make the hormones oestrogen and progesterone. About once a month, usually one egg is released.",
        "The fimbriae, finger-like fringes at the end of each fallopian tube, sweep the released egg into the tube. Tiny hairs and waves of muscle move it towards the uterus; fertilisation usually happens in the tube.",
        "The uterus is a hollow, pear-shaped muscle behind and above the bladder. Its lining, the endometrium, thickens each cycle to receive a fertilised egg and is shed as a period if none arrives. In pregnancy its muscular wall stretches to hold the baby and contracts to push it out through the cervix and vagina.",
        "The bladder sits in front of the uterus. As it fills, stretch sensors signal the urge to go; then its wall contracts while the outer sphincter, which you control, relaxes.",
      ],
      parts: [
        "Hip bones, sacrum and coccyx — the bony pelvis",
        "Uterus — fundus, body and cervix",
        "Ovaries — make eggs, oestrogen and progesterone",
        "Fallopian tubes — carry the egg to the uterus",
        "Urinary bladder — stores urine",
        "Uterine arteries and veins — blood supply to the uterus",
      ],
      facts: [
        ["Uterus length", "About 7.5 cm (3 in)"],
        ["Ovary size", "About the size of an almond"],
        ["Fallopian tube length", "About 10–12 cm"],
        ["Typical cycle", "About 28 days"],
      ],
      source: "https://www.innerbody.com/image/repfov.html",
    },
  },

  shoulder: {
    title: "Shoulder",
    system: "Skeletal · Muscular",
    color: "cream",
    summary:
      "The shoulder is the most mobile joint in the body, letting the arm swing in a full circle. That freedom comes from a shallow socket held in place mostly by muscles rather than bone.",
    how: [
      "The main joint is a ball-and-socket: the round head of the humerus sits against the glenoid, a shallow dish on the shoulder blade (scapula). A ring of cartilage, the labrum, deepens the socket a little.",
      "Because the socket is so shallow, four rotator cuff muscles wrap around the ball, keep it centred, and rotate the arm.",
      "The collarbone (clavicle) acts as a strut that holds the shoulder out to the side. It is the only bony link between the arm and the trunk.",
      "The trade-off for this range of motion is stability: the shoulder dislocates more easily than other joints, and the rotator cuff tendons and labrum can wear or tear over time.",
    ],
    parts: [
      "Humeral head — the ball of the joint",
      "Glenoid of the scapula — the shallow socket",
      "Labrum — cartilage rim deepening the socket",
      "Clavicle — collarbone strut",
      "Acromioclavicular joint — where collarbone meets shoulder blade",
      "Rotator cuff — four stabilising muscles",
      "Deltoid — big muscle that lifts the arm out to the side",
    ],
    facts: [
      ["Bones", "3 (humerus, scapula, clavicle)"],
      ["Rotator cuff muscles", "4"],
      ["Joint type", "Ball-and-socket"],
    ],
    source: "https://www.innerbody.com/image/skel17.html",
  },

  upperArm: {
    title: "Upper Arm",
    system: "Skeletal · Muscular",
    color: "peach",
    summary:
      "The upper arm runs from the shoulder to the elbow around a single long bone, the humerus. Muscles on the front and back work as a pair to bend and straighten the elbow.",
    how: [
      "The humerus has a rounded head that forms the ball of the shoulder joint and a shaped lower end that forms the hinge of the elbow. Shoulder muscles such as the deltoid and rotator cuff attach along it.",
      "On the front, the biceps and the brachialis beneath it bend the elbow. The biceps also turns the forearm so the palm faces up, as when you turn a doorknob or a screwdriver.",
      "On the back, the three-headed triceps straightens the elbow by pulling on the point of the elbow (the olecranon).",
      "Muscles can only pull, never push, so they work in opposing pairs: when the biceps contracts, the triceps relaxes, and the other way round.",
    ],
    parts: [
      "Humerus — the single upper-arm bone",
      "Biceps brachii — bends the elbow, turns the palm up",
      "Brachialis — main elbow flexor under the biceps",
      "Triceps brachii — straightens the elbow",
      "Deltoid insertion — where the shoulder muscle attaches",
      "Radial nerve — spirals around the back of the humerus",
    ],
    facts: [
      ["Bones", "1 (the humerus)"],
      ["Biceps heads", "2"],
      ["Triceps heads", "3"],
      ["Elbow flexors", "3 (biceps, brachialis, brachioradialis)"],
    ],
    source: "https://www.innerbody.com/anatomy/muscular/arm-hand",
  },

  elbow: {
    title: "Elbow",
    system: "Skeletal",
    color: "cream",
    summary:
      "The elbow is where the upper arm meets the two forearm bones. It works mainly as a hinge, bending and straightening the arm, and also lets the forearm rotate.",
    how: [
      "The spool-shaped trochlea at the bottom of the humerus fits snugly into a notch on the ulna, making a tight hinge that moves in one plane.",
      "Next to it, the head of the radius sits against the rounded capitulum. This looser fit lets the radius spin in place, which is what turns your palm up and down.",
      "Strong collateral ligaments on each side hold the bones together, and the ring-shaped annular ligament wraps the head of the radius. When the arm straightens, the olecranon of the ulna locks into a groove on the humerus and stops it bending backwards.",
      "The 'funny bone' is really the ulnar nerve, which runs in a shallow groove behind the inner bump of the elbow, where a knock sends tingling into the little finger.",
    ],
    parts: [
      "Trochlea and capitulum — the humerus's two joint surfaces",
      "Olecranon — bony point of the elbow on the ulna",
      "Radial head — pivots for forearm rotation",
      "Collateral ligaments — side-to-side stability",
      "Annular ligament — ring that holds the radius in place",
      "Ulnar nerve — the 'funny bone'",
    ],
    facts: [
      ["Bones", "3 (humerus, ulna, radius)"],
      ["Joint type", "Synovial hinge"],
      ["Main movements", "Bending, straightening, forearm rotation"],
    ],
    source: "https://www.innerbody.com/image/skel14.html",
  },

  forearm: {
    title: "Forearm",
    system: "Skeletal · Muscular",
    color: "peach",
    summary:
      "The forearm runs from elbow to wrist and holds two parallel bones, the radius and ulna. It contains most of the muscles that move the wrist and fingers.",
    how: [
      "The ulna lies on the little-finger side and forms the main hinge at the elbow. The radius lies on the thumb side and forms most of the wrist joint.",
      "Turning the palm down (pronation) and up (supination) happens because the radius rolls around the ulna. The pronator muscles turn the palm down; the supinator and biceps turn it up.",
      "Muscles on the palm side flex the wrist and fingers, and muscles on the back extend them. Their long tendons run through the wrist into the hand, which keeps the hand slim while still allowing a strong grip.",
      "The flexors are generally stronger than the extensors, which is why gripping firmly takes more effort than opening the hand.",
    ],
    parts: [
      "Radius — thumb-side bone that rotates",
      "Ulna — little-finger-side bone that anchors the elbow",
      "Interosseous membrane — sheet joining the two bones",
      "Flexors — bend the wrist and fingers",
      "Extensors — straighten the wrist and fingers",
      "Pronator teres — turns the palm down",
      "Supinator — turns the palm up, with the biceps",
    ],
    facts: [
      ["Bones", "2 (radius and ulna)"],
      ["Muscle groups", "Flexors in front, extensors behind"],
      ["Rotation", "Pronation (palm down) and supination (palm up)"],
    ],
    source: "https://www.innerbody.com/image_skelfov/skel20_new.html",
  },

  wrist: {
    title: "Wrist",
    system: "Skeletal · Nervous",
    color: "cream",
    summary:
      "The wrist is a compact cluster of eight small carpal bones between the forearm and the hand. It lets the hand tilt in many directions and gives a protected route for tendons and nerves.",
    how: [
      "The carpal bones sit in two rows of four. The radius meets the top row to form the main wrist joint, and the bones glide slightly against one another to make bending and side-to-side movement smooth.",
      "On the palm side the carpals form a shallow arch. A tough band, the flexor retinaculum, roofs it over to make the carpal tunnel.",
      "Through this tunnel run nine finger-flexor tendons and the median nerve. If swelling crowds the tunnel, the nerve gets squeezed, causing the numbness and tingling of carpal tunnel syndrome.",
      "The scaphoid, at the base of the thumb, is the carpal bone most often broken, usually from a fall onto an outstretched hand.",
    ],
    parts: [
      "Proximal row — scaphoid, lunate, triquetrum, pisiform",
      "Distal row — trapezium, trapezoid, capitate, hamate",
      "Radiocarpal joint — the main wrist joint",
      "Flexor retinaculum — roof of the carpal tunnel",
      "Median nerve — passes through the tunnel",
      "Flexor tendons — nine run through the tunnel",
    ],
    facts: [
      ["Carpal bones", "8, in two rows of 4"],
      ["Tendons in carpal tunnel", "9"],
      ["Nerve in carpal tunnel", "Median nerve"],
    ],
    source: "https://www.innerbody.com/image/skel13.html",
  },

  hand: {
    title: "Hand",
    system: "Skeletal · Muscular · Nervous",
    color: "brown",
    summary:
      "The hand is a precise tool built from many small bones, joints and tendons. Its opposable thumb lets it grip powerfully or handle tiny objects with care.",
    how: [
      "Five metacarpal bones form the palm, and each connects to a finger. The fingers have three phalanges each, while the thumb has two.",
      "Most of the muscle power comes from the forearm, through long tendons that pull on the finger bones like strings on a puppet. Small muscles inside the hand fine-tune the position of each finger.",
      "The thumb sits on a saddle-shaped joint that lets it swing across the palm to touch each fingertip. This is what makes both the power grip and the pinch grip possible.",
      "Three nerves serve the hand. The median nerve covers the thumb side and fine movements, the ulnar nerve covers the little-finger side and many small hand muscles, and the radial nerve helps open the hand.",
    ],
    parts: [
      "Metacarpals — five bones of the palm",
      "Phalanges — finger bones, 3 per finger and 2 in the thumb",
      "Thumb saddle joint — allows opposition",
      "Flexor and extensor tendons — move the fingers",
      "Intrinsic hand muscles — fine control",
      "Median, ulnar and radial nerves — sensation and movement",
    ],
    facts: [
      ["Bones per hand", "27 (including the wrist)"],
      ["Metacarpals", "5"],
      ["Phalanges", "14"],
      ["Main nerves", "3 (median, ulnar, radial)"],
    ],
    source: "https://www.innerbody.com/image/skel13.html",
  },

  hip: {
    title: "Hip Joint",
    system: "Skeletal · Muscular",
    color: "cream",
    summary:
      "The hip joint connects the thigh bone to the pelvis. It is a deep ball-and-socket joint built to carry body weight while still moving in almost every direction.",
    how: [
      "The ball is the rounded head of the femur. It sits in the acetabulum, a deep cup in the hip bone formed where the ilium, ischium and pubis meet.",
      "Smooth cartilage covers both surfaces and a ring of cartilage, the labrum, deepens the socket. Synovial fluid inside the capsule keeps the joint gliding with little friction.",
      "Compared with the shoulder, the socket is much deeper and the surrounding ligaments are among the strongest in the body. That makes the hip very stable, though a little less mobile.",
      "Powerful muscles such as the gluteals and the iliopsoas move the hip and hold the pelvis level, so you don't tip over each time you stand on one leg.",
    ],
    parts: [
      "Femoral head — the ball",
      "Acetabulum — the deep socket",
      "Labrum — cartilage rim around the socket",
      "Femoral neck — angled link between head and shaft",
      "Iliofemoral ligament — strong band at the front",
      "Gluteal muscles — extend and steady the hip",
      "Iliopsoas — main hip flexor",
    ],
    facts: [
      ["Joint type", "Ball-and-socket"],
      ["Bones forming the socket", "3 (ilium, ischium, pubis)"],
      ["Load when standing", "Each hip carries about half the upper body"],
    ],
    source: "https://www.innerbody.com/image/skel15.html",
  },

  thigh: {
    title: "Thigh",
    system: "Skeletal · Muscular",
    color: "peach",
    summary:
      "The thigh runs from the hip to the knee around the femur, the longest and strongest bone in the body. Large muscle groups wrap around it to power walking, running and climbing.",
    how: [
      "The femur's head forms the hip joint, its angled neck holds the shaft away from the pelvis, and its two rounded condyles at the bottom form the knee.",
      "The four quadriceps muscles on the front straighten the knee, which is what you use to stand up from a chair or kick a ball.",
      "The three hamstrings on the back bend the knee and extend the hip. Together with the quadriceps they act as an opposing pair.",
      "The adductors on the inner thigh draw the legs together. The sciatic nerve, the largest nerve in the body, runs down the back of the thigh to supply the hamstrings and most of the leg below the knee.",
    ],
    parts: [
      "Femur — head, neck, shaft and condyles",
      "Greater trochanter — bony knob where hip muscles attach",
      "Quadriceps — 4 muscles that straighten the knee",
      "Hamstrings — 3 muscles that bend the knee",
      "Adductors — pull the thigh inward",
      "Sciatic nerve — the body's largest nerve",
    ],
    facts: [
      ["Femur", "Longest and strongest bone"],
      ["Quadriceps", "4 muscles"],
      ["Hamstrings", "3 muscles"],
    ],
    source: "https://www.innerbody.com/image_skelfov/skel25_new.html",
  },

  knee: {
    title: "Knee",
    system: "Skeletal",
    color: "cream",
    summary:
      "The knee is the largest joint in the body, where the femur meets the tibia with the kneecap at the front. It works mainly as a hinge but relies heavily on ligaments and cartilage to stay stable.",
    how: [
      "The rounded ends of the femur roll and glide on the flatter top of the tibia, so the knee can bend and straighten. When it is bent, it can also twist a little.",
      "Two cruciate ligaments cross inside the joint. The ACL stops the shin sliding forward and the PCL stops it sliding back. Collateral ligaments on each side resist sideways forces.",
      "Two crescent-shaped menisci made of tough cartilage sit between the bones. They spread load and absorb shock when you run or jump.",
      "The kneecap (patella) sits inside the quadriceps tendon. It acts as a lever that makes the thigh muscles more effective at straightening the leg.",
    ],
    parts: [
      "Patella — kneecap",
      "ACL — anterior cruciate ligament",
      "PCL — posterior cruciate ligament",
      "MCL and LCL — collateral ligaments on each side",
      "Medial and lateral menisci — cartilage shock absorbers",
      "Patellar ligament — kneecap to shinbone",
      "Bursae — fluid sacs that reduce friction",
    ],
    facts: [
      ["Bones", "3 (femur, tibia, patella)"],
      ["Main ligaments", "4 (ACL, PCL, MCL, LCL)"],
      ["Menisci", "2"],
      ["Patella", "The body's largest sesamoid bone"],
    ],
    source: "https://www.innerbody.com/image/skel16.html",
  },

  shin: {
    title: "Shin & Calf",
    system: "Skeletal · Muscular",
    color: "peach",
    summary:
      "The lower leg runs from the knee to the ankle and has two bones, the thick tibia and the slender fibula. The calf muscles behind them push you forward with every step.",
    how: [
      "The tibia, or shinbone, carries almost all of the body's weight from the knee down to the ankle. Its front edge lies just under the skin, which is why a knock to the shin hurts so much.",
      "The fibula runs along the outside. It carries little weight but anchors muscles and forms the outer bump of the ankle, helping to keep it steady.",
      "The gastrocnemius and soleus make up the calf. They join into the Achilles tendon and lift the heel, letting you rise onto your toes and push off when walking.",
      "On the front, the tibialis anterior lifts the foot towards the shin, so the toes clear the ground as the leg swings forward.",
    ],
    parts: [
      "Tibia — the main weight-bearing shinbone",
      "Fibula — thin outer bone that anchors muscles",
      "Gastrocnemius — the visible two-headed calf muscle",
      "Soleus — deep, flat calf muscle",
      "Tibialis anterior — lifts the front of the foot",
      "Achilles tendon — joins the calf to the heel",
    ],
    facts: [
      ["Bones", "2 (tibia and fibula)"],
      ["Tibia", "Second-longest bone in the body"],
      ["Main calf muscles", "2 (gastrocnemius and soleus)"],
    ],
    source: "https://www.innerbody.com/anatomy/skeletal/leg-foot",
  },

  ankle: {
    title: "Ankle",
    system: "Skeletal · Muscular",
    color: "cream",
    summary:
      "The ankle joins the lower leg to the foot. It is a tight hinge that points the foot up and down, while joints just below it let the foot tilt on uneven ground.",
    how: [
      "The ends of the tibia and fibula form a bony bracket that grips the talus, the top bone of the foot. The two bumps you can feel either side of the ankle are the malleoli.",
      "This fit makes a hinge for two main movements: pointing the toes down (plantarflexion) and pulling them up (dorsiflexion). Side-to-side tilting happens mostly at the joint just below, between the talus and the heel bone.",
      "Ligaments brace both sides. The thick deltoid ligament supports the inner ankle, and three smaller ligaments support the outer side, which is where most sprains happen.",
      "The Achilles tendon, the strongest tendon in the body, attaches the calf muscles to the heel bone and pulls the heel up with each step.",
    ],
    parts: [
      "Talus — the foot bone that forms the joint",
      "Medial and lateral malleoli — ankle bumps from tibia and fibula",
      "Deltoid ligament — strong inner support",
      "Lateral ligaments — outer support, often sprained",
      "Achilles tendon — calf to heel",
    ],
    facts: [
      ["Bones meeting at the joint", "3 (tibia, fibula, talus)"],
      ["Joint type", "Synovial hinge"],
      ["Achilles tendon", "Thickest and strongest tendon in the body"],
    ],
    source: "https://www.innerbody.com/anatomy/skeletal/leg-foot/ankle-foot",
  },

  foot: {
    title: "Foot",
    system: "Skeletal · Muscular",
    color: "brown",
    summary:
      "The foot is a springy, arched platform that carries your whole weight. It has to be flexible enough to adapt to the ground and rigid enough to push you forward.",
    how: [
      "Each foot has 26 bones: seven tarsals at the back, including the heel bone and the talus, five long metatarsals, and fourteen toe bones.",
      "The bones are arranged in arches held up by ligaments and muscles. The arches spread your weight across the foot and act like a spring, storing and releasing energy with each step.",
      "A step begins as the heel strikes the ground. The foot then rolls forward and flattens slightly to absorb the impact, and finally stiffens into a lever so the calf can push off through the big toe.",
      "Small muscles inside the foot make constant adjustments that keep you balanced, whether you are standing still or walking on uneven ground.",
    ],
    parts: [
      "Calcaneus — heel bone, the largest foot bone",
      "Talus — links the foot to the leg",
      "Tarsals — 7 bones of the rear and midfoot",
      "Metatarsals — 5 long bones of the forefoot",
      "Phalanges — 14 toe bones",
      "Arches — two lengthwise, one across",
    ],
    facts: [
      ["Bones per foot", "26"],
      ["Breakdown", "7 tarsals, 5 metatarsals, 14 phalanges"],
      ["Arches", "3 (medial, lateral, transverse)"],
      ["Both feet", "52 bones, about a quarter of the skeleton"],
    ],
    source: "https://www.innerbody.com/anatomy/skeletal/leg-foot/ankle-foot",
  },
};
