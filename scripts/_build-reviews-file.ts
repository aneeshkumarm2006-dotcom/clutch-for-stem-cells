/**
 * Ad-hoc: merge scraped Google quotes into each clinic's existing
 * externalReviews block and emit an import file.
 *
 * The importer replaces `externalReviews` wholesale, so this reads what is
 * already stored and writes the Google quotes onto it. Without that merge every
 * Reddit summary and editor-written Google summary would be wiped.
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

const SCRAPED: Record<string, { url: string; highlights: H[] }> = {
  "fountain-life": {
    url: "https://www.google.com/maps/place/Fountain+Life+-+Naples/@26.2691523,-81.800267,17z/data=!4m8!3m7!1s0x88db1fd1e55900b1:0xcc974474af406762!9m1!1b1!16s%2Fg%2F11swt2h2mz",
    highlights: [
      {
        author: "patrick monsivais",
        rating: 5,
        publishedLabel: "a year ago",
        text: "This physical saved my life. I signed up for the Apex plan. They take a deep dive way past your normal physical. I was there for five hours, it didn't seem like five, and the staff were very nice and professional. I discovered some things that if left untreated would have lead to serious consequences. It's been worth every penny.",
      },
      {
        author: "Christopher Kagan",
        rating: 5,
        publishedLabel: "a year ago",
        text: "All I can say is wow. What an amazing facility and group of doctors and team. I had a study done of my heart with contrast to make sure everything looks good. Highly recommend Fountain Life and Dr. Kingsbury, he was fantastic!",
      },
      {
        author: "Starlet Jordan",
        rating: 1,
        publishedLabel: "3 years ago",
        text: "I would not recommend this clinic. They already make thousands of dollars and then they also choose to make extra commission off of the supplements they prescribe on the fullscript Website. Other practitioners offer 35% discount and they choose to make money over giving patients a discount. The wait is also long.",
      },
    ],
  },
  // Listing website is stemulus.org, the record says stemulushealth.com. Same
  // brand, and the listing name and street address both match the record, so
  // the domain guard was overridden.
  "stemulus-innovative-healthcare": {
    url: "https://www.google.com/maps/place/Stemulus+Innovative+Healthcare/@33.5162369,-112.0545767,17z/data=!4m8!3m7!1s0x872b13455c447935:0x8492a48c71f31c43!9m1!1b1!16s%2Fg%2F11h7c7ghry",
    highlights: [
      {
        author: "Alyssia Escobar",
        rating: 5,
        publishedLabel: "3 years ago",
        text: "Stan, Dr. Lane, and Dr. Ewald were amazing! Their kindness, positivity, and honesty was overwhelming. They were down to earth and made us feel so comfortable. We appreciated all of the information we received as well. We drove all the way from Reno so my father-in-law could receive stem cell treatment for a TBI.",
      },
      {
        author: "Aubrey Young",
        rating: 5,
        publishedLabel: "7 years ago",
        text: "Dr. Jaime Ewald at Stemulus is the most intelligent, progressive doctor that I have ever met. She integrates body physiology with natural healing techniques and gets results. In the time I have been under her care, I have never felt better.",
      },
      {
        author: "Ulanda Seabrook",
        rating: 2,
        publishedLabel: "a year ago",
        text: "Great staff, however I didn't experience any changes at all after receiving treatment here. I've heard so much about stem cell therapy and thought this would help me a lot. However I didn't. Very Dissatisfied especially for the money I spent and the travel it took for me to get there, and I didn't like that they didn't give you a follow up call or email.",
      },
    ],
  },
  "primehealth-denver": {
    url: "https://www.google.com/maps/place/PrimeHealth+Denver+Functional+Medicine/@39.7424314,-105.0631362,17z/data=!4m8!3m7!1s0x876c79062025c795:0x7b0658326160581d!9m1!1b1!16s%2Fg%2F11h3bjrbdn",
    highlights: [
      {
        author: "Scott Crapo",
        rating: 5,
        publishedLabel: "4 months ago",
        text: "PrimeHealth has been one of the best healthcare experiences I've had. The team was attentive, responsive, and easy to communicate with from day one. They explained everything clearly and made sure my wellness plan actually made sense for me. Savannah and Nicole were especially helpful in identifying and addressing health and lifestyle issues that had been affecting me for years.",
      },
      {
        author: "Jillian Dinsdale",
        rating: 5,
        publishedLabel: "5 months ago",
        text: "I would recommend Prime Health and my experience with Abby to anyone! I had such a positive experience getting my health back on track. Everyone in the office is so welcoming and the office is really set up to feel like a comforting place. I can definitely attribute so much of my current wellbeing to the work put in here.",
      },
    ],
  },
  "forever-labs": {
    url: "https://www.google.com/maps/place/Forever+Labs/@42.2773904,-83.8007236,17z/data=!4m8!3m7!1s0x883cae3dab6aaaab:0xa316473ba3595651!9m1!1b1!16s%2Fg%2F11g8vcxs2m",
    highlights: [
      {
        author: "Andrew Nadhir",
        rating: 5,
        publishedLabel: "5 years ago",
        text: "Forever Labs is amazing. They made it incredibly easy and safe to bank my stem cells and I have peace of mind knowing they're in the best of hands. Knowing I have my stem cells banked for 2, 5, or 30 years down the road is a great feeling.",
      },
      {
        author: "Anthony Bewlz",
        rating: 5,
        publishedLabel: "5 years ago",
        text: "It's been a few years since banking my SC's and I can honestly say I'm beyond glad that I did. The staff was and has been absolutely 'top shelf' during the entire process, from intake all the way to today with ongoing updates. Cant say enough about my experience!",
      },
      {
        author: "Amna Husain",
        rating: 2,
        publishedLabel: "5 years ago",
        text: "I have never received any updates about the research or the advancements made thus far. I was told by my doctor's office (conveniently after the surgery and banking) that no other procedures have been approved and they don't know if that will happen in the next 5, 10 or 20 years. I am paying $250 for annual banking but for what?",
      },
    ],
  },
  cenegenics: {
    url: "https://www.google.com/maps/place/Cenegenics+Las+Vegas/@36.1682205,-115.2866037,17z/data=!4m8!3m7!1s0x80c8bf84616ef795:0x34aa65abc3184402!9m1!1b1!16s%2Fg%2F1tfjwkjj",
    highlights: [
      {
        author: "Tony Chaskelson",
        rating: 5,
        publishedLabel: "2 years ago",
        text: "Most thorough medical exam I have ever participated in. I like the whole body, mind and general health approach and came away with a great deal of very useful information and plans and vitamins to improve the quality of my life. Dr. Patel and the team are excellent and very detailed in their approach and solutions.",
      },
      {
        author: "Kodiak Yazzie",
        rating: 5,
        publishedLabel: "6 years ago",
        text: "The evaluation was eye opening and detailed. I was able to learn valuable information about preventive health care and took away so much from the meeting with Dr. Leake. The entire process was easy, they came to my home at my convenience to draw blood and my office visit was exceptional and thorough.",
      },
    ],
  },
  // No website on the clinic record, so the domain guard had nothing to compare.
  // Matched instead on an exact listing name and the Sortis Business Tower
  // address, both of which agree with the record.
  "regeneration-clinic-of-panama": {
    url: "https://www.google.com/maps/place/Regeneration+Clinic+Of+Panama/@8.9871032,-79.5202496,17z/data=!4m8!3m7!1s0x8faca91ead421d4d:0x315c58e27012876a!9m1!1b1!16s%2Fg%2F11sh5m3k_4",
    highlights: [
      {
        author: "Bobby McCree",
        rating: 5,
        publishedLabel: "5 months ago",
        text: "Both knees are feeling great 7 days after procedure. My left knee has a slight tear in miniscus, my right knee is arthritic from acl tear in 1996. 2 days after injections my wife and I was enjoying a mini vacation touring Panama. I would definitely recommend to anyone looking to avoid surgery. 5 stars to Regeneration clinic of Panama.",
      },
      {
        author: "Diane Barnard",
        rating: 5,
        publishedLabel: "3 months ago",
        text: "Great care and plenty of information about the treatment and care. Everyone is well informed about the procedures, professional & knowledgeable. Accommodations were very nice as well. Dr Ponte was very professional and thorough. The clinic was very clean and seemed very high tech and state of art.",
      },
      {
        author: "Andy Basler",
        rating: 1,
        publishedLabel: "3 weeks ago",
        text: "I went in November and received treatment on my shoulders. Unfortunately I was seeing absolutely ZERO positive effects. My good shoulder actually has gone bad since. The post care was not existent. The people are very nice and the facilities is nice, but I wish more people would have told there after effects. I spent a lot of money with no results.",
      },
    ],
  },
  "next-health": {
    url: "https://www.google.com/maps/place/Next+Health+in+West+Hollywood/@34.0925094,-118.3780608,17z/data=!4m8!3m7!1s0x80c2bec1be21cc25:0x9a2a34e8a68274c5!9m1!1b1!16s%2Fg%2F11c0r5n450",
    highlights: [
      {
        author: "Roper Vicente",
        rating: 5,
        publishedLabel: "3 months ago",
        text: "So today I went to Next Health to get a Super B energy Shot, it stung a little not gonna lie but while I was waiting they gave me a tour of all the new things they are offering at the Sunset Plaza location and I was amazed by how many wellness and health boosting devices they have, from the full body Infrared session to the Oxygen chamber.",
      },
      {
        author: "Yvonne Zaragoza",
        rating: 5,
        publishedLabel: "5 months ago",
        text: "I had an amazing experience at Next Health. Their IV therapy truly felt like it gave me another chance at life. I left feeling refreshed and so much better. Dani was incredible and made the entire process smooth, easy, and comfortable. I highly recommend them if you're looking to improve your wellness!",
      },
    ],
  },
  // Korean listing (차움), matched on chaum.net. Only Latin-script reviews are
  // quoted: the rest are in Korean, and machine-translating a stranger's words
  // while leaving their real name attached is not a quote any more.
  chaum: {
    url: "https://www.google.com/maps/place/%EC%B0%A8%EC%9B%80(Chaum)/@37.5232348,127.0441642,17z/data=!4m8!3m7!1s0x357ca4776f20368b:0xaa21c646611672c2!9m1!1b1!16s%2Fg%2F1tgfn1wd",
    highlights: [
      {
        author: "Deus ex machina",
        rating: 5,
        publishedLabel: "a month ago",
        text: "Private checkups are available. The concept is that the doctor comes to you, rather than you going there. Everyone is kind and considerate. It feels less like a factory.",
      },
      {
        author: "albert limanto",
        rating: 5,
        publishedLabel: "a year ago",
        text: "This Chaum is a high end medical center (they combine a high tech, future treatment to a medical check up). Their program is amazing and out of the box. The medical facilities and the building facilities is amazing. Anti aging, if you looking for the true meaning of anti aging, you should go here.",
      },
      {
        author: "S L",
        rating: 1,
        publishedLabel: "2 years ago",
        text: "I went here for a facial and other treatments. It was ok but the problem is they charge foreigners more. I went to another clinic and found the prices to be fair. You can find clinics that do the same if not better at a fairer price.",
      },
    ],
  },
  "michigan-center-for-regenerative-medicine": {
    url: "https://www.google.com/maps/place/Michigan+Center+for+Regenerative+Medicine/@42.6430987,-83.1256303,17z/data=!4m8!3m7!1s0x8824e9d76e1277b5:0x9e8334830cd23b0a!9m1!1b1!16s%2Fg%2F11f_knxqtz",
    highlights: [
      {
        author: "Tony Coy",
        rating: 5,
        publishedLabel: "3 months ago",
        text: "Dr Nabity and his staff are great. They take the time to expansively listen and share knowledge about conditions, injuries, and treatments. I can tell Dr Nabity is passionate about helping his clients and avoiding surgery if possible. He's clear about plan of action and that has helped me a lot! I feel more comfortable with my health and moving forward because of Michigan Center for Regenerative Medicine. I highly recommend.",
      },
      {
        author: "James R",
        rating: 5,
        publishedLabel: "a month ago",
        text: "I cannot say anything good enough about Dr. Santa and the entire staff at Michian centers of Regentive Medicine! I suffered for 6 yrs with debilitating cervical instability in my c1- c2 through c7 area. Dr Santa Ana recommeneded PRP for me. Its has been life changing for me with just the 1st treatment. I have now gotten a second treatment because the 1st was so successful!",
      },
    ],
  },
  // The listing's top critical review accuses the physician by name of being
  // "a sham" over an Alzheimer's reversal claim. Left out deliberately: that is
  // an allegation about a named doctor, not a service complaint, and a
  // directory republishing it under his own profile carries a different kind of
  // exposure. Flagged for the owner rather than quietly published.
  "blatman-health-and-wellness-center": {
    url: "https://www.google.com/maps/place/Blatman+Health+and+Wellness+Center/@39.2075921,-84.3790807,17z/data=!4m8!3m7!1s0x884053c2e0f55857:0x1827d7b686db1c5!9m1!1b1!16s%2Fg%2F1tdcxs43",
    highlights: [
      {
        author: "Davina Campbell",
        rating: 5,
        publishedLabel: "3 months ago",
        text: "Dr B, Jennifer, & Lois have been treating my chronic conditions for over 25 years now. Their level of education excels the generic plan of care offered by other facilities. I love that I can trust their medical advice and I do not have to ever worry about my safety. They really are amazing! Thank you so much for treating me over these years.",
      },
      {
        author: "Pam Gilchrist",
        rating: 5,
        publishedLabel: "Edited 4 months ago",
        text: "Dr. Blatman is the most knowledgeable medical expert I have ever treated with. He is particularly excellent at complex medical cases including Ehlers-Danlos Syndrome, Fibromyalgia, pain management and personalized healing protocols that may be different from mainstream medicine. I have been a patient for nearly 30 years and he has given me my life back.",
      },
    ],
  },
  "pur-form": {
    url: "https://www.google.com/maps/place/PUR-FORM/@26.3827476,-80.0967033,17z/data=!4m8!3m7!1s0x88d8e1f8e325c51d:0x487318139a484478!9m1!1b1!16s%2Fg%2F11g1npm6y1",
    highlights: [
      {
        author: "Morgan Acunto",
        rating: 5,
        publishedLabel: "9 months ago",
        text: "I've had such a great experience at PUR-FORM! It's always so seamless to get appointments when I need them, scheduling is quick and easy, and the team is so responsive. The nurses are incredibly accommodating and attentive, always making sure I'm comfortable and cared for throughout my visit.",
      },
      {
        author: "Keyan",
        rating: 5,
        publishedLabel: "a month ago",
        text: "When you step inside Pur-Form you're immediately greeted with a lovely professional staff. Nina & Gabi truly make this place feel like home. I feel great. I look great. And the staff is great. Special shoutout to Nina and Gabi.",
      },
    ],
  },
  "regenerative-medicine-la": {
    url: "https://www.google.com/maps/place/Regenerative+Medicine+LA+-+Dr.+Mark+Ghalili+DO/@34.0909028,-118.3927378,17z/data=!4m8!3m7!1s0x80c2bc0827c0132f:0xc3502d9f1d297ae9!9m1!1b1!16s%2Fg%2F11gfc163yr",
    highlights: [
      {
        author: "Jennifer Booher",
        rating: 5,
        publishedLabel: "5 months ago",
        text: "Our eleven year old son was disabled by fluoroquinolone antibiotics. He was unable to walk, unable to sleep, unable to see. He was in constant pain. Dr. Ghalili's treatment made all the difference. Our son wasn't healed overnight, but he slowly regained health and strength over the following months. Today, he can run, jump, play, sleep, and see! No more pain! We are so grateful for Dr. Ghalili!",
      },
    ],
  },
  // Listing is "Regenestem Medical Clinic | Plantation" at the clinic's own
  // street address; its Maps website field points at an agency microsite, so
  // the domain guard was overridden on a name + address match.
  regenestem: {
    url: "https://www.google.com/maps/place/Regenestem+Medical+Clinic+%7C+Plantation/@26.122388,-80.277337,17z/data=!4m8!3m7!1s0x88d907c527b7605d:0x67d775d337f71419!9m1!1b1!16s%2Fg%2F11ckvkrx47",
    highlights: [
      {
        author: "Wells Landen",
        rating: 5,
        publishedLabel: "2 weeks ago",
        text: "I visited Regenestem Medical Clinic to know about stem cells for back pain. The providers carefully evaluated my condition and explained my options in a way that was easy to understand. The team was friendly, professional, and genuinely cared about my comfort. Overall, I had a very positive experience with the clinic.",
      },
      {
        author: "Anthony Genovese",
        rating: 5,
        publishedLabel: "2 months ago",
        text: "I have a Shoulder injury from a car accident at is 2 years old, had physical therapy twice with no results, researched PRP and found Regenestem. Had my first treatment 1 month ago and my condition got better. Having another treatment now to see if it gets even better than the first one. I know these types of therapy do take a little time and im willing to give ot a shot.",
      },
    ],
  },
  "innovations-stem-cell-center": {
    url: "https://www.google.com/maps/place/Innovations+Stem+Cell+Center/@32.9209464,-96.7736363,17z/data=!4m8!3m7!1s0x864c203fa8844287:0x94e10634ee8e35ca!9m1!1b1!16s%2Fg%2F11bwqrlkn3",
    highlights: [
      {
        author: "Nicole Busse",
        rating: 5,
        publishedLabel: "a month ago",
        text: "Dr. Johnson was very professional. He educated me on the process, and what the outcome of the results might be. I was treated for extensive scar tissue and skin damage secondary to radiation treatment for breast cancer. My skin condition improved in some areas. The scar tissue in my chest and thoracic area has been released some. I've gained more movement in my arm and in my chest wall.",
      },
      {
        author: "Rodney Rowlett",
        rating: 5,
        publishedLabel: "2 months ago",
        text: "I had a procedure for my lungs about 2 months ago. I have severe emphysema and had 1/2 of one of my lungs removed because of cancer. I have not noticed any improvement since the procedure but I'm still hopeful. The proses of getting it done (Dr, nurses, office personnel) was a pleasant experience so it deserves a 5 star review.",
      },
    ],
  },
  "boulder-biologics": {
    url: "https://www.google.com/maps/place/Boulder+Biologics/@40.0158109,-105.2367119,17z/data=!4m8!3m7!1s0x876bedced945b403:0xf98d217eb3a12593!9m1!1b1!16s%2Fg%2F11g19n7fp9",
    highlights: [
      {
        author: "Lilli B",
        rating: 5,
        publishedLabel: "a year ago",
        text: "Dr. Glowney, Ryan, and Dawn have made every visit to Boulder Biologics superior to any other doctor's office. The team is so knowledgeable, caring, and thorough with all aspects of your visit. They are completely honest, instead of giving you false expectations. I have never experienced an entire team caring for their patients to this degree. The client education is top notch!",
      },
      {
        author: "Kathy Morey",
        rating: 5,
        publishedLabel: "4 months ago",
        text: "Dr. Rudolf is excellent. She listens well, is extremely thoughtful and detail focused in developing her treatment plans, and thorough in applying treatment.",
      },
      {
        author: "Tyler Mueller",
        rating: 2,
        publishedLabel: "a year ago",
        text: "I went out to this clinic for a long covid headache and GI issues. They treated me very well and professionally but unfortunately I didn't get any benefits nor will I feel like many long haulers will from their painful and expensive procedure. I know two people who did this as well and it didn't help at all with their pain. I wouldn't recommend this or any stem cell treatment as a long covid solution.",
      },
    ],
  },
  cellaxys: {
    url: "https://www.google.com/maps/place/Cellaxys+-+Stem+Cell+Therapy+Clinic+In+Las+Vegas/@36.0840308,-115.299038,17z/data=!4m8!3m7!1s0x80c8b992f9c37e6f:0x37f79f8a9cb1fa72!9m1!1b1!16s%2Fg%2F11f655rghg",
    highlights: [
      {
        author: "Kendrick Brewer",
        rating: 5,
        publishedLabel: "3 months ago",
        text: "I recently visited Cellaxys Stem Cell Therapy Clinic in Las Vegas and had a really positive experience. The staff was friendly, professional, and made me feel comfortable from the moment I walked in. They explained the stem cell therapy process clearly and answered all of my questions without rushing me. I appreciated how they focused on creating a treatment plan that fit my needs instead of giving a one-size-fits-all approach.",
      },
      {
        author: "Sheila Aguilar",
        rating: 5,
        publishedLabel: "3 months ago",
        text: "The Physicians here listens to their patients, and recommends different treatments tailored to your needs. Highly recommend to treat your pain!",
      },
    ],
  },
  "bluetail-medical-group": {
    url: "https://www.google.com/maps/place/Bluetail+Medical+Group/@38.6818968,-90.4950561,17z/data=!4m8!3m7!1s0x87df2aa01acff81d:0x6a6025d40b4778f!9m1!1b1!16s%2Fg%2F12hkm95vz",
    highlights: [
      {
        author: "Anthony Holdener",
        rating: 5,
        publishedLabel: "4 months ago",
        text: "Dr. Crane was excellent. He has a great bedside manner and made me feel comfortable from the start. He explained things thoroughly, reviewed my prior X-rays and MRI with me directly, and clearly walked me through what they showed and what the next steps should be. I truly appreciated how thoughtful, knowledgeable, and communicative he was throughout the visit.",
      },
      {
        author: "jennifer murphy",
        rating: 5,
        publishedLabel: "11 months ago",
        text: "We can't say enough good things about Dr. Bayes and his team at Bluetail Medical Group. Our 17-year-old son received a PRP injection for a UCL injury and both appointments were fantastic. Dr. Bayes has the best bedside manner and he is so positive and down-to-earth. He did not rush through anything and answered all of our many questions. A+",
      },
      {
        author: "Mr C",
        rating: 1,
        publishedLabel: "6 months ago",
        text: "Terrible patient relations. I wish I could get my wasted $6k back. Save your effort, go to one of the many other providers. I have given them months and months of 3rd and 4th chances to try and make an effort.",
      },
    ],
  },
  "centeno-schultz-clinic": {
    url: "https://www.google.com/maps/place/Centeno-Schultz+Clinic/@39.9275735,-105.1418382,17z/data=!4m8!3m7!1s0x876b8c8e418a2da1:0xcf2abc9a022686a3!9m1!1b1!16s%2Fg%2F1td0tckq",
    highlights: [
      {
        author: "Robert Long",
        rating: 5,
        publishedLabel: "6 months ago",
        text: "Most professional, Perfected facility I have ever been to. Staff is amazingly organized and thorough, when one is done, next person is in. And they played my Bruce Hornsby music!!! For all who are considering Regenerative, be sure to join the FB/YouTube on Sunday Live discussion with Dr. Centeno where you can ask any question! I believe its at 12 EST",
      },
      {
        author: "Ashley Ortega",
        rating: 5,
        publishedLabel: "4 months ago",
        text: "Thank you so much for the opportunity CSC at a chance to get my life back! Everyone at CSC is very humanitarian, kind and compassionate. Dr. Markle is very patient and answered all my questions and put my nerves at ease. One of the staff gave me a hug and I felt very well taken care off from the start to finish of my procedure. They called me the next day to make sure I was okay after my procedure.",
      },
    ],
  },
  thrivemd: {
    url: "https://www.google.com/maps/place/thriveMD+Denver+Colorado+-+Regenerative+Medicine/@39.6016575,-104.9027062,17z/data=!4m8!3m7!1s0x876c8503559c5ca7:0x4c615645b4392b4a!9m1!1b1!16s%2Fg%2F11g65grmp8",
    highlights: [
      {
        author: "Aden Martin",
        rating: 5,
        publishedLabel: "a year ago",
        text: "Dr Brandt and his team at Thrive md clinic are caring and professional. They have effectively treated bad spinal discs on both myself and well as my wife. If you can avoid risky surgeries with non invasive Stem cell treatment, why not.",
      },
      {
        author: "Ian Hilton",
        rating: 5,
        publishedLabel: "8 years ago",
        text: "The stem cell treatment I had for my shoulder from Dr Brandt at Thrive far exceeded my expectations. Before the treatment I could barely do a single press-up and swimming even breaststroke was difficult. Now press ups are no problem and neither is swimming overarm. The increase in range of motion and decrease of discomfort in the shoulder started within about 2 weeks of the treatment and improved steadily over the next 6 months. Well worth it and they are very nice people too!",
      },
    ],
  },
  "docere-clinics": {
    url: "https://www.google.com/maps/place/Docere+Clinics:+Harry+Adelson,+N.D./@40.7232467,-111.5380095,17z/data=!4m8!3m7!1s0x87528aa0f96bcf03:0x7b63f6e671791035!9m1!1b1!16s%2Fg%2F1pv61hkl9",
    highlights: [
      {
        author: "Elliot Karathanasis",
        rating: 5,
        publishedLabel: "a year ago",
        text: "I cannot say enough good things about Dr. Harry Adelson and his entire staff! They are the absolute best in the business. I had extreme pain in my right knee and a terrible case of plantar fasciitis in my left foot. I struggled for months with PT to no avail. The care they showed me and their incredible follow up was first class all the way.",
      },
      {
        author: "Ian Douglas",
        rating: 5,
        publishedLabel: "6 years ago",
        text: "You feel a sense of calm just walking into Docere Clinics, all the staff are really personable and kind, the entire experience is zen. Everyone is professional and the whole process is really smooth. Even when you're recovering from a major surgical procedure they do everything to check in with you and take care of your needs. I can't thank them enough.",
      },
    ],
  },
  "r3-stem-cell": {
    url: "https://www.google.com/maps/place/R3+Stem+Cell/@33.7422155,-111.9339994,12z/data=!4m8!3m7!1s0x872b7948e95c8963:0x54928b83ee086004!9m1!1b1!16s%2Fg%2F11thjcjkgb",
    highlights: [
      {
        author: "Devine cwi",
        rating: 5,
        publishedLabel: "4 months ago",
        text: "I had 1 shot to my shoulder and was able to gain full recovery with range of motion and strength building exercises. Beautiful results!!!",
      },
      {
        author: "Erica Soria",
        rating: 5,
        publishedLabel: "a year ago",
        text: "Dr Greene and Samantha are absolutely fantastic! The staff was professional, knowledgeable, and truly cared about my well-being. The stem cell treatment was thoroughly explained and tailored to my needs. I felt supported every step of the way. Highly recommend this clinic for anyone exploring regenerative therapies—it exceeded my expectations!",
      },
    ],
  },
  stemedix: {
    url: "https://www.google.com/maps/place/Stemedix/@27.7634227,-82.643687,17z/data=!4m8!3m7!1s0x88c2e5c115b41d3d:0xc92de72427fdd653!9m1!1b1!16s%2Fg%2F12hq9rzhx",
    highlights: [
      {
        author: "Brenda Smith",
        rating: 5,
        publishedLabel: "8 months ago",
        text: "This stem cell therapy has been one of the best thing I have ever done for myself. I have had fibromyalgia pain for almost 50 years. I am 81, and had no idea if this would make a difference, but I was a the end of my rope. It has been 14 weeks and I am pain free for the first time in many years. I am now walking unaided, needing a walker before. I highly recommend Stemedix. The Procedure was very easy and painless.",
      },
      {
        author: "Joyce Adams",
        rating: 5,
        publishedLabel: "4 months ago",
        text: "I have gotten stem cells for Multiple Sclerosis twice now. This last visit, Two months after receiving stem cell therapy, the numbness from the waist down no longer had a definitive line around my waist and I no longer had dead areas in my legs, within 4 months, I no longer walk like one leg is longer that the other.",
      },
    ],
  },
};

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
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
