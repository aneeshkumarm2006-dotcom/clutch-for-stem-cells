/**
 * Ad-hoc: merge scraped Google quotes into each clinic's existing
 * externalReviews block and emit an import file.
 *
 * The importer replaces `externalReviews` wholesale, so this reads what is
 * already stored and writes the Google quotes onto it. Without that merge every
 * Reddit summary and editor-written Google summary would be wiped.
 *
 * This file holds ONE round at a time. Round 1 (fountain-life through stemedix,
 * 21 clinics) is already in the database; SCRAPED below is round 2, the tail of
 * the directory that had not been covered yet.
 *
 * House rules applied when picking quotes, in addition to the importer's own
 * gates:
 *  - Newest first. A quote is only worth publishing if it still describes the
 *    business as it operates now.
 *  - Excerpts are taken from the front of a review and always stop on a
 *    sentence boundary. Runs of whitespace are collapsed; no word is changed.
 *  - English originals only. Under `hl=en` Google silently machine-translates
 *    Korean and Chinese reviews, and those carry a "Translated by Google"
 *    toggle. Publishing a translation under a real reviewer's name is not a
 *    quote, so translated nodes are filtered out at scrape time.
 *  - Grave allegations against a named individual are not published. Where one
 *    exists it is noted in a comment for the owner to decide on, following the
 *    call already made on blatman-health-and-wellness-center.
 */
import { writeFileSync } from "node:fs";
import dns from "node:dns";
if (process.env.SCRIPT_DNS) dns.setServers(process.env.SCRIPT_DNS.split(","));

import { dbConnect } from "@/lib/db";
import { Clinic } from "@/models";

interface H {
  author: string;
  rating: number;
  text: string;
  publishedLabel: string;
}

const SCRAPED: Record<
  string,
  { url: string; rating?: number; reviewCount?: number; highlights: H[] }
> = {
  biote: {
    url: "https://www.google.com/maps/place/Biote/@32.8722839,-96.9714584,17z/data=!4m8!3m7!1s0x864e8264df8952f1:0xa9ca4c96fdc9be!8m2!3d32.8722839!4d-96.9714584!9m1!1b1!16s%2Fg%2F11b6dq_srj",
    highlights: [
      {
        author: "angela harrison",
        rating: 5,
        publishedLabel: "9 months ago",
        text: "When I had my ovaries removed, I did not realize all that would follow. They took much more than I had expected. BIOTE has given me back a big part of myself. And my hair! Is no longer falling out! Anyone needing help with sleep, moods, emotional regulation, brain fog, ADD, getting things done, sleeping through the night, sugar cravings, mindless eating, and anger — this is for you.",
      },
      {
        author: "DaytimeTraveler",
        rating: 1,
        publishedLabel: "a year ago",
        text: "Thought this clinic would help me with my severe menopause issues but the doctor created other more severe issues. Unbeknownst to me I was given a very high dose of testosterone along with estrogen and progesterone. My voice got scratchy, body hair started to grow more, I had bleeding after nothing for 7 years and there were physical developments that are now permanent despite it being over a year. When I brought it up the doctor acted all put out about it.",
      },
      {
        author: "kent lochmandy",
        rating: 1,
        publishedLabel: "a year ago",
        text: "Biote needs to train their retailers much better. More monitoring is necessary. Even after the first dose of pellets caused complications Biote's answer as to why where wrong. Find a better thought out solution to you needs please. For your well being.",
      },
    ],
  },
  // The one critical review on the listing accuses a named staff member of
  // being "hungry for money" and of using a doctor's photo to sell a programme
  // the doctor is not really part of. Left out on the blatman precedent: that
  // is an allegation about a named individual, not a service complaint.
  "california-wellness-institute": {
    url: "https://www.google.com/maps/place/California+Wellness+Institute/@33.7585866,-116.3990121,17z/data=!4m8!3m7!1s0x80dafd9a24955555:0x619df32a1bc09253!8m2!3d33.7585866!4d-116.3990121!9m1!1b1!16s%2Fg%2F11ggs1c1lz",
    highlights: [
      {
        author: "Holly Weaver",
        rating: 5,
        publishedLabel: "3 months ago",
        text: "This was my first Colon Hydrotherapy and the experience was amazing. Carol was super educated and explained everything in perfect detail. She knows her stuff! I will be definitely coming back as a loyal customer.",
      },
      {
        author: "Ms. Yosselin",
        rating: 5,
        publishedLabel: "10 months ago",
        text: "I had such a great experience with Colon Hydrotherapy! Monica walked me through everything step by step, which really helped ease my nerves and made the whole process stress-free. It was comfortable, painless, and so much easier than I expected. I'd definitely recommend it to anyone wanting to make a positive, healthy life choice!",
      },
      {
        author: "Jamie Louise Wolf",
        rating: 5,
        publishedLabel: "8 months ago",
        text: "I have had to have 2 major surgeries on my right shoulder. I was in constant achy pain and with just 1 treatment that constant ache and discomfort is gone!! I am in complete amazement with EPAT treatment! The in detail assessment that Mike gave me was outstanding. I am telling everyone I know to contact CWI for this amazing treatment.",
      },
    ],
  },
  // Listing is Korean (셀리닉의원) and most of its reviews are too. Only the
  // four written in English are quotable; the rest render as Google
  // translations under hl=en.
  //
  // The stored record had no Google branch at all, so the rating read off the
  // verified listing is filled in here as well. Everywhere else in this batch
  // the rating was already on file and is left alone.
  "cellinique-clinic": {
    url: "https://www.google.com/maps/place/%EC%85%80%EB%A6%AC%EB%8B%89%EC%9D%98%EC%9B%90(Cellinique+clinic)/@37.520544,127.032143,17z/data=!4m8!3m7!1s0x357ca3002bbf219d:0xd1df4cb0ea1697ef!8m2!3d37.520544!4d127.032143!9m1!1b1!16s%2Fg%2F11x7yhl56l",
    rating: 4.8,
    reviewCount: 14,
    highlights: [
      {
        author: "Margaret Fu",
        rating: 5,
        publishedLabel: "2 months ago",
        text: "I recently had an exceptional experience at Cellinique. As a tourist, I was concerned about potential language barriers, but I had absolutely no issues—there were staff fluent in English and communicate very professionally throughout the entire process. The environment is incredibly serene, clean, and well-designed, felt like I was in a hotel.",
      },
      {
        author: "Liana",
        rating: 5,
        publishedLabel: "6 months ago",
        text: "I had a great experience at this clinic and would highly recommend it to international visitors. The chief doctor carefully assessed my skin condition and facial structure before starting the treatment, which felt very personalized. It was also a huge plus that he is fluent in English, making communication easy and reassuring. Knowing that he frequently lectures overseas added to my trust.",
      },
      {
        author: "Yewon Lee",
        rating: 5,
        publishedLabel: "6 months ago",
        text: "I'm very very sensitive to pain and tend to be nervous about non-surgical aesthetic treatments, so I wanted something natural rather than dramatic. As my smile lines became more noticeable, I decided to try a collagen-stimulating injectable treatment called Radiesse instead of fillers, and I'm really happy with the result. The improvement looks subtle and natural.",
      },
    ],
  },
  // Newest review on the listing (1 star, two weeks old) alleges that a nurse
  // practitioner's Spironolactone prescription put the reviewer's mother in
  // hospital. No individual is named, but it is a specific patient-harm claim
  // and it is held back for the owner rather than published unreviewed. The
  // Rimestad review carries the critical signal in the meantime.
  "evexias-medical-centers": {
    url: "https://www.google.com/maps/place/EVEXIAS+Medical+Centers/@32.9276885,-97.1212797,17z/data=!4m8!3m7!1s0x864dd43ffb082319:0x2cbc91126783739!8m2!3d32.9276885!4d-97.1165161!9m1!1b1!16s%2Fg%2F1td3l_fp",
    highlights: [
      {
        author: "Eddie Vargas",
        rating: 5,
        publishedLabel: "a month ago",
        text: "My provider, Nicole Taylor is awesome, she is very caring. Very thorough. An extremely kind. I highly Recommend Evexias and Nicole",
      },
      {
        author: "Lonna Rimestad",
        rating: 3,
        publishedLabel: "a year ago",
        text: "I absolutely love Samantha. She has been great helping me get my hormones in balance and dealing with the sudden weight gain in my 50s, despite working out 5x a week and eating plenty of protein. UGH! The office is also great at running on time and not making people wait for too long. One thing that's really off putting, and I'm sure many people don't realize, is that they are marking up prescriptions 50-60% over the cost being charged by the outsourced pharmacies!",
      },
      {
        author: "Leslie Pickering",
        rating: 5,
        publishedLabel: "Edited 3 years ago",
        text: "Katelyn is awesome! She's very knowledgeable about all things skin care related. She performed my first microneedling procedure and it was a really good experience. Can't wait to work with Katelyn again to get my skin in the best shape possible!",
      },
    ],
  },
  "gangnam-js-hospital": {
    url: "https://www.google.com/maps/place/Gangnam+JS+Hospital/@37.4899038,127.0337135,17z/data=!4m8!3m7!1s0x357ca3f478a5d001:0xbe60dd4aa8dda70e!8m2!3d37.4899038!4d127.0337135!9m1!1b1!16s%2Fg%2F1q5btqcf9",
    highlights: [
      {
        author: "Anthony Rodgers",
        rating: 5,
        publishedLabel: "2 months ago",
        text: "I am extremely pleased to have found Gangnam JS Hospital. I underwent their stem cell-based cartilage regeneration and leg realignment procedures for my right knee a little more than a year ago. It was one of the best decisions I have ever made..I came back this year to remove the plate and screws from the leg realignment and continue my journey back to athletic mobility.",
      },
      {
        author: "Anselm Mugele",
        rating: 5,
        publishedLabel: "2 months ago",
        text: "My stay at Gangnam JS Hospital in Seoul was a remarkable experience. I traveled to Korea to undergo a knee treatment involving stem cells derived from umbilical cord blood, combined with an intensive rehabilitation program. While the treatment itself was the main reason for my journey, what impressed me most was the quality and intensity of the rehabilitation process.",
      },
      {
        author: "Ji Won Kim",
        rating: 1,
        publishedLabel: "4 months ago",
        text: "No wonder why scheduling an appointment was so easy. The doctor's attitude was absolutely unacceptable. He was yelling in the room and I had to pay for him to say a single sentence. Absolutely do not come here. Patients are treated without any dignity or humanity. Truly disappointing",
      },
    ],
  },
  // Reception here is about mail-order fulfilment rather than clinical care,
  // so the quotes are too. The critical one is excerpted from its opening,
  // which is where the substance is; that cut also stops before it names a
  // support rep.
  "invigor-medical": {
    url: "https://www.google.com/maps/place/Invigor+Medical/@46.2754624,-119.2110532,17z/data=!4m8!3m7!1s0x54987847c995aef3:0xede94b2dcdc701c!8m2!3d46.2754624!4d-119.2110532!9m1!1b1!16s%2Fg%2F11gy1vkh1k",
    highlights: [
      {
        author: "Memphis Slimbo",
        rating: 5,
        publishedLabel: "5 months ago",
        text: "Had some issues with a delayed and potentially late order. This was a big concern because of the need for continual refrigeration of the product. Brooklyn was on the case, responsive and followed through until resolution of the issue. Has also been excellent in the past and it's a real plus ti have the same “go to” person for the overall service.",
      },
      {
        author: "Adam Hamilton",
        rating: 5,
        publishedLabel: "5 months ago",
        text: "Rosa did an excellent job at customer service. I am very pleased with the response from the team at Invigor Medical. They are the only company I would trust with supplying my supplements. They use the best compounding pharmacies in the nation and provide unmatchable customer service. Thank you",
      },
      {
        author: "A Kozich",
        rating: 1,
        publishedLabel: "Edited 7 months ago",
        text: "Things were good at first, then they started sending half expired meds. Then they tell you that requests for compensation have to be forwarded to management who will take days to contact the pharmacy and then they'll \"make a decision\".",
      },
    ],
  },
  "male-excel": {
    url: "https://www.google.com/maps/place/Male+Excel/@35.2277133,-80.8564497,17z/data=!4m8!3m7!1s0x8856a10000dd12c5:0xaf35947fd1a77440!8m2!3d35.2277133!4d-80.8564497!9m1!1b1!16s%2Fg%2F11xfgw9dj5",
    highlights: [
      {
        author: "Jack Fayard",
        rating: 1,
        publishedLabel: "a month ago",
        text: "Good product but these folks don't give a hoot about customer. It was time for my refill so I did the questionnaire and submitted. A week later still no review, ended up having to cancel as was leaving town and wasn't sure I'd be home. I only had two more days of meds left so they couldn't get them to me fast enough. Shop around please.",
      },
      {
        author: "Craig",
        rating: 5,
        publishedLabel: "6 months ago",
        text: "No complaints at all. Customer service is friendly and quick to respond. Doctor was really nice and thorough . Meds shipped quick. I feel much better and look forward to being a customer for the foreseeable future.",
      },
      {
        author: "Donald Andrae",
        rating: 4,
        publishedLabel: "11 months ago",
        text: "I went from 178 lb to 140 pounds it took almost a year. I am now around 145 pounds but put on some muscle not fat and I am now in the best shape I have been in probably 30 years if not longer.",
      },
    ],
  },
  // Listing website is gn.nanoori.co.kr (the Gangnam branch), the record says
  // ihc.nanoori.co.kr (the international healthcare centre). Same registrable
  // domain, and 731 Eonju-ro matches the record exactly.
  "nanoori-hospital": {
    url: "https://www.google.com/maps/place/NANOORI+Hospital+(Gangnam+Branch)/@37.5202957,127.0339776,17z/data=!4m8!3m7!1s0x357ca38c85877309:0xdf0f6e23f409beea!8m2!3d37.5202957!4d127.0339776!9m1!1b1!16s%2Fg%2F1td7x053",
    highlights: [
      {
        author: "Ohana Umemoto",
        rating: 5,
        publishedLabel: "a month ago",
        text: "They quickly gave me X-rays and an MRI which allowed them to diagnose and treat my back pain. I am from Hawaii and do not speak Korean. They provided a translator, Jenny, who patiently listened to my explanations and descriptions of my pain. The doctor clearly described what the tests indicated and the recommended treatments as well as scheduled a follow up appointment. All the tests and treatments were performed in 3-4 hours.",
      },
      {
        author: "Amy Young",
        rating: 5,
        publishedLabel: "2 months ago",
        text: "Super efficient and so helpful. I had an English speaking guide who stuck with me the whole time and did a great job of taking my medical history and explaining what I wanted to each person I interacted with. I had an x-ray, consultation, MRI and another consultation all in 3 hours, at a totally reasonable price.",
      },
      {
        author: "Zenny Frei",
        rating: 4,
        publishedLabel: "2 months ago",
        text: "Helpful assistance throughout. Staffs are friendly and supportive. Explanations by doctors are clear. Sequence of lab tests could be improved though: Went thru MRI and Xray twice, each round after seeing different physician. Overall a positive experience of treatment in a foreign land.",
      },
    ],
  },
  // Listing website is en.nucellin.com, the record says seoulorthoclinic.com,
  // so the domain guard was overridden on an exact name and address match
  // (Nucellin Orthopedics, 71 Dokseodang-ro 4F, Yongsan-gu).
  "nucellin-orthopedic-clinic": {
    url: "https://www.google.com/maps/place/Nucellin+Orthopedics+(Hannam)/@37.5340824,127.0083847,17z/data=!4m8!3m7!1s0x357ca30014a5408f:0x5ec515fe48851c2c!8m2!3d37.5340824!4d127.0083847!9m1!1b1!16s%2Fg%2F11xsk0nvyx",
    highlights: [
      {
        author: "John Grosvenor",
        rating: 5,
        publishedLabel: "a month ago",
        text: "I cannot recommend the Nucellin Clinic highly enough. Dr. Kim, and his highly accomplished physiotherapists, as well as other staff, were professional, experienced and highly effective in resolving debilitating pain I have experienced for many years. My experience with the clinic and its professional staff was rewarding in every respect. I have since returned for further treatments with the same satisfying results and will be going back again to address overall health and wellness.",
      },
      {
        author: "Anna K.",
        rating: 5,
        publishedLabel: "3 months ago",
        text: "During my recent visit to Korea, I came to the clinic because I was interested in regenerative treatment for lower back pain. After the necessary evaluation and a thorough consultation, I decided to proceed with the procedure. Dr. Kim never pressured me at any point and took plenty of time to explain the treatment in detail until I felt fully informed and comfortable moving forward. The facilities and equipment were excellent, and the physical therapists and specialized staff members were professional, knowledgeable, and very responsive to questions.",
      },
      {
        author: "Natalya Kumar",
        rating: 1,
        publishedLabel: "3 months ago",
        text: "DO NOT go to this clinic as an international client. Nucellin Clinic in Seoul charged me much more than what they verbally quoted. I had less than 2 mins with the actual doctor. There was an English speaking agent, she pulled me out of the doctor's cabin saying she will handle me and they asked me to do bunch of surgeries. I asked her what the procedure and cost would be but she could not explain. When I told her I'm looking for rehab and exercises she got upset and angry.",
      },
    ],
  },
  "optimal-bio": {
    url: "https://www.google.com/maps/place/Optimal+Bio/@35.7426019,-78.7802147,17z/data=!4m8!3m7!1s0x89acf331524fb63f:0xf2658f51a06a9d9a!8m2!3d35.7426019!4d-78.7802147!9m1!1b1!16s%2Fg%2F11c1nz72tn",
    highlights: [
      {
        author: "Richard Wisotzkey",
        rating: 5,
        publishedLabel: "3 months ago",
        text: "Optimal Bio has been taking care of my testosterone and thyroid needs for well over 10yrs. They took me from constantly feeling tired and worn out, to having the energy to be active, get things done, and enjoy life. I'm 69yrs old. It keeps me stepping, but I can keep pace with my grandson, and I know he loved it.",
      },
      {
        author: "Betty B",
        rating: 5,
        publishedLabel: "5 months ago",
        text: "I receive pellets quarterly - it has been a life changing experience. The constant anxiety, feeling tired and depressed, inability to focus...gone! It's also nice not to mess with patches or creams. I see Rachel - she's awesome! She checks my levels, answers any questions and makes adjustments as needed. I've been on these pellets for many years and I highly recommend Optimal Bio.",
      },
      {
        author: "Burns Family",
        rating: 1,
        publishedLabel: "4 months ago",
        text: "Buyer beware. I was a moderately* content T pellet patient with Optimal Bio from May 2024 through early 2026. However, when I decided to start HRT (estradiol gel and progesterone capsules) through another provider in October 2025, Optimal Bio refused to provide my scheduled T pellet in January 2026. The decision felt abrupt and unexpected, and the explanations they offered didn't make scientific sense given my medical background. My impression is that they were simply unhappy I chose not to buy into their pellet-based E therapy.",
      },
    ],
  },
  "reset-iv": {
    url: "https://www.google.com/maps/place/Reset+IV/@36.1869644,-115.3030135,17z/data=!4m8!3m7!1s0x80c8c55d033c1af1:0xa8ab3fa2c3e34654!8m2!3d36.1869644!4d-115.3030135!9m1!1b1!16s%2Fg%2F11kxrw167j",
    highlights: [
      {
        author: "Brittany",
        rating: 5,
        publishedLabel: "2 months ago",
        text: "James came to my hotel room at the Cosmopolitan to do hydration IV therapy- he was prompt, cordial and very knowledgeable. I told him my symptoms to which he suggested some add ons without pressure. Got set up and going quickly- he was good comfortable conversation during treatment. I will be keeping him in my contacts for the next time we come to Vegas.",
      },
      {
        author: "liz ortuno",
        rating: 5,
        publishedLabel: "2 months ago",
        text: "I recently tried IV therapy and had a great experience. Daniel was very knowledgeable, friendly, and made me feel comfortable throughout the entire process. Highly recommended booking with him!! The treatment was relaxing, and I noticed a significant improvement in my energy levels and overall hydration afterward.",
      },
      {
        author: "Tired Local",
        rating: 1,
        publishedLabel: "4 weeks ago",
        text: "The original company was sold in 2025. It's nowhere close to what it used to be. It's no longer 24/7. They still claim convenient, timely booking, but it's not true. They told me it would be 16 hours before someone could get to me. I used to recommend Reset IV to everyone. I had the swag, I invested, I believed in the brand..this is not that company.",
      },
    ],
  },
  // Listing website is sottopelletherapy.com, the record says
  // tuteramedical.com; same practice at an exact name and address match
  // (8412 E Shea Blvd Ste 101, Scottsdale), so the domain guard was overridden.
  //
  // Worth knowing before reading these: the listing's 81 reviews are almost all
  // a single 2015 review drive. The only recent one with text is the 1 star
  // below, so two decade-old positives carry the other side. Their age is
  // visible to readers through publishedLabel.
  sottopelle: {
    url: "https://www.google.com/maps/place/SottoPelle/@33.583531,-111.899521,17z/data=!4m8!3m7!1s0x872b7521f0cd4b1f:0x363204e6c3df293f!8m2!3d33.583531!4d-111.899521!9m1!1b1!16s%2Fg%2F1vf9cvb0",
    highlights: [
      {
        author: "Kartune Meyer",
        rating: 1,
        publishedLabel: "a year ago",
        text: "Fired for continual errors, changing doctors without consent, and changing their rules based on their daily whim. I had one good doctor there who also ditched them. Poor customer service. The nurses treat you like a child. Go elsewhere.",
      },
      {
        author: "Carol Carrillo",
        rating: 5,
        publishedLabel: "10 years ago",
        text: "I've been going to SotoPelle for years getting their bio-identical hormones. It has helped me a great deal both physically and mentally. My body lets me know when it's time to go to my next appointment. I can really feel a difference. Steve Nunn in the Chandler office is efficient, friendly and if I feel anything at all, it's just the pin prick from the numbing shot but most of the time I don't even feel that.",
      },
      {
        author: "Erin Benard",
        rating: 5,
        publishedLabel: "10 years ago",
        text: "I have been with Sotto Pelle for 4-5 years now and the experience has been wonderful. I have had a definite change in my overall well being. Dr. Rhodes and the staff at the Glendale office are great!",
      },
    ],
  },
  "trt-nation": {
    url: "https://www.google.com/maps/place/TRT+Nation/@28.0611578,-82.3795128,17z/data=!4m8!3m7!1s0x88db3f80424a05b3:0x5f29fe6ae26d2b34!8m2!3d28.0611578!4d-82.3795128!9m1!1b1!16s%2Fg%2F11h5k8xr3y",
    highlights: [
      {
        author: "Scott Hax",
        rating: 5,
        publishedLabel: "a month ago",
        text: "Have used TRTNation for several years. Excellent customer service. No gimmicks or pushy sales staff. Providers are amazing! They all seem genuinely caring, they have real expertise, always available for follow-up. Interdictions with providers is never rushed, they always have time for my questions.",
      },
      {
        author: "Stephen E",
        rating: 5,
        publishedLabel: "3 months ago",
        text: "TRT Nation has been great so far. They've scheduled appointments quickly and answered my questions honestly with no nonsense. Refills are easy to navigate and everything has shipped on time and arrived either sooner than expected or on the earlier end of the estimated time frame for delivery. No complaints so far. Prices are fair and on par to slightly less than other similar online services.",
      },
      {
        author: "Jonathan Parnell",
        rating: 5,
        publishedLabel: "a month ago",
        text: "I'm 46 and noticed my natural testosterone levels had taken a serious dive. I decided to give TRT Nation a shot, and it has been the best decision I've made in years. Just two weeks into the program and I already feel 10x better. My energy, focus, and overall drive are completely back. The onboarding process was fast, professional, and seamless.",
      },
    ],
  },
  ways2well: {
    url: "https://www.google.com/maps/place/Ways2Well+-+Austin/@30.3144958,-97.8528178,17z/data=!4m8!3m7!1s0x8644b5a5a73f93d7:0x9864345db09acb30!8m2!3d30.3144958!4d-97.8528178!9m1!1b1!16s%2Fg%2F11swxh2yry",
    highlights: [
      {
        author: "Josh Mesa",
        rating: 5,
        publishedLabel: "2 months ago",
        text: "I came in for stem cell therapy today . The facility is breathtaking. The staff were well informed, friendly and outgoing. The least painful injection therapy I've ever received. As a health and wellness professional myself I was wildly impressed and can't wait to come back! Looking forward to feeling the results in the coming weeks.",
      },
      {
        author: "Chris Riley",
        rating: 5,
        publishedLabel: "2 months ago",
        text: "This was one of the most amazing experineces from front to back. My original appointment with Kirsten made me feel comfortable and I knew I was at the right place. Then I was helped by a few other people to make this as affordable as possible. Once I went to Aistin for my therapy, I met some of the coolest people and again felt very welcome and at home. My NP Selina was the best, spent a good amount of time trying to ensure we administered the stem cells to the correct area and was so kind.",
      },
      {
        author: "Carrie Church",
        rating: 5,
        publishedLabel: "2 months ago",
        text: "This ways 2 well journey has been the best life changing experience. Between the comprehensive bloodwork ,supplements, and now just had stem cells today. My husband had stem cells in his knee and hasn't had any pain in last 3 years. Highly recommend this life changing experience",
      },
    ],
  },
};

/**
 * Listings checked in this round that produced nothing publishable, recorded so
 * the next pass does not spend the calls again.
 *
 *  agelessrx              Listing is an unclaimed "Business administration
 *                         service" stub: website matches, but no address, no
 *                         reviews tab, only a Write-a-review button.
 *  marek-health           No Google Business Profile at all. Maps answers
 *                         "can't find Marek Health"; 35 W Huron St Pontiac
 *                         resolves to the street address only.
 *  sh-clinic              4.8 (12), but exactly one review is in English and it
 *                         is a detailed labiaplasty account. Wrong content to
 *                         republish on a stem cell directory under a real name.
 *  yonsei-bh-clinic       Whole listing is one review, not in English.
 *  yonsei-sarang-hospital 3.3 (11), none of them in English.
 */
const NO_QUOTES = [
  "agelessrx",
  "marek-health",
  "sh-clinic",
  "yonsei-bh-clinic",
  "yonsei-sarang-hospital",
] as const;

async function main() {
  const { loadEnvConfig } = await import("@next/env");
  loadEnvConfig(process.cwd());
  await dbConnect();

  const today = new Date().toISOString().slice(0, 10);
  const records = [];

  for (const [slug, data] of Object.entries(SCRAPED)) {
    const c = await Clinic.findOne({ slug, isDeleted: false })
      .select("slug externalReviews")
      .lean();
    if (!c) {
      console.log(`✗ ${slug}: not found`);
      continue;
    }
    const existing = (c.externalReviews ?? {}) as Record<string, unknown>;
    const g = (existing.google ?? {}) as Record<string, unknown>;

    for (const h of data.highlights) {
      if (h.text.length > 600) {
        console.log(
          `  ! ${slug}: "${h.author}" quote is ${h.text.length} chars`,
        );
      }
    }

    records.push({
      slug,
      externalReviews: {
        ...existing,
        google: {
          ...g,
          ...(data.rating != null ? { rating: data.rating } : {}),
          ...(data.reviewCount != null
            ? { reviewCount: data.reviewCount }
            : {}),
          url: data.url,
          highlights: data.highlights,
          checkedAt: today,
        },
      },
    });
    console.log(`✓ ${slug}: ${data.highlights.length} quote(s) merged`);
  }

  writeFileSync(
    "scripts/reviews.json",
    `${JSON.stringify(records, null, 2)}\n`,
    "utf8",
  );
  console.log(`\nWrote ${records.length} record(s) to scripts/reviews.json`);
  console.log(`Checked with no publishable quotes: ${NO_QUOTES.join(", ")}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
