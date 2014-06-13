/*
 * Profile and Character Loading JS for d3robot.com, a Diablo 3 damage calculator
 * By Colton Hornstein, www.coltonhornstein.com, Copyright 2014
 * 
 * On dom load, prepares to accept account information
 * On correct account info, loadprofile()'s up to 9 characters through connection to Blizzard via API
 * On clicking a character, loadchar()'s the character through same API and sorts through:
 *      gear for stat names and amounts - parsetext()
 *      skills for matching buff types in static array - nested in loadchar()
 *      skills for primary/secondary spender/generator types - parseskill()
 *          and loads most of that into either total[] stats object or char[] skills object.
 * When all gear is loaded (at end of loadchar()), creates a table with hoverable items, through use of Blizzard + secondhand API, as well as
 *  generates damage tables for different phases - generatedps()
 * Also loads Paragon Points with paragonsuggest() and attemps to spend them in the most efficient way based on gear/skills loaded from loadchar.
 * 
 * On new profile load, clears all previous output and prepares for new output with clearoutput().
 * 
 * 
 */


var g_host, g_name, g_code, g_id; //make all function variables global, so they can be re-accessed
var slotnames = ["Helm", "Chest", "Boots", "Gloves", "Shoulders", "Legs", "Bracers", "Main Hand", "Off Hand", "Belt", "Right Ring", "Left Ring", "Amulet"];

//load the characters from profile
function loadprofile(host, name, code) //gets the profile json
{ 
    //make variables to globals
    g_host = host;
    g_name = name;
    g_code = code;

    clearoutput();
    //set all borders to orange (was black at 000) on account switch too!
    $(charboxes).children('div').css("border-color", "#fa761e");

    for (var j = 0; j < 9; j++) //9 is current max of icons, may change
        {
            $('#cb'+j).css('visibility', 'hidden'); //invisible icons
            //$('#cb'+j).children('a').attr("title", ""); //show no title, not need if invis?
            $('#cb'+j).children('a').off("click"); //remove click events
            //give all borders a hover effect..
            $('#cb'+j).hover(function(){ //f1 is over, f2 is out
                //change this border to tan
                $("#"+this.id).css('border-color', '#f3e6d0');
                }, function(){
                //change all borders to orange
                $(charboxes).children('div').css("border-color", "#fa761e");
            });
        }
    //make call to d3 api
    $.getJSON("http://"+host+".battle.net/api/d3/profile/"+name+"-"+code+"/?callback=?",
            //"http://us.battle.net/api/d3/profile/Ommin-1211/",
        function(result) {
            $.each(result.heroes, function(i, field){ //key, value
                var curcb = "#cb" + i; //easier id of current character block
                //find icon string and put it in block, make block visible
                var icon = (field.class).slice(0,3) + field.gender; //first 3 plus gender is filepath for icon
                document.getElementById("cb"+i).getElementsByTagName("img")[0].src = "img/portraits/"+icon+".jpg"; //change box image
                $(curcb).css('visibility', 'visible');
                //change a name and link  
                $(curcb).children('a').attr("title", field.name + ", " + field.level); //hover                       
                $(curcb).children('a').click(function(){
                    loadchar(field.id); 
                    //set all borders to orange (was black at 000)
                    $(charboxes).children('div').css("border-color", "#fa761e");
                    //set current one to white
                    $(curcb).css("border-color", "#F3E6D0");
                    //set class variable to current
                    classname = field.class;
                });  

            }); //end of each  
            //$("#output").append("Last Hero Played: " +result.lastHeroPlayed+ "<br>"); //doesnt always return..
        }); //eo result
};    //eo loadprofile

//loads the items/skills from selectd hero
function loadchar(id)
{
    clearoutput(); 
g_id = id; //make id global, not required?  
window.total = {"Primary" : 217, "Elite" : 0, "Skill" : 0, "Chance" : 5, "Damage" : 50,  "AttackSpeed" : 0, "Avgdmg" : 0,
                "Move" : 0, "BaseAttackSpeed" : 1, "Bonus" : 1, "Mindmg" : 0, "Maxdmg" : 0, 
    "Elementp" : {"Fire" : 0, "Lightning" : 0, "Cold" : 0, "Holy" : 0, "Poison" : 0, "Arcane" : 0, "Physical" : 0} ,
    "Sets" : {}}; //initialize total stats array
window.char = {"primary" : {"type" : "Physical", "damage" : 0} , "secondary" : {"type" : "Physical", "damage" : 0}}; //character array
//char defaults to physical to prevent NaN
//primary has a base of 217, then add gear, no way to add paragon!
//Chance and Damage are for crit, have basses of 5 and 50
//fire, lightning, cold, holy, poison, arcane and physical
$.getJSON("http://"+g_host+".battle.net/api/d3/profile/"+g_name+"-"+g_code+"/hero/"+id+"?callback=?",
    function(result) {  
        $.each(result.skills.active, function(count, field){
            if (typeof field.skill !== "undefined"){
                if (field.skill.categorySlug === "primary" || field.skill.categorySlug === "secondary") { //generator or spender
                     parseskill(field.skill.categorySlug, field.skill.description); //find element type, percentage

                    if (typeof field.rune !== "undefined"){ //if not no runes
                        parseskill(field.skill.categorySlug, field.rune.description); //again for the rune just in case
                        if (field.skill.categorySlug === "secondary"){
                            mainskillrune = field.rune.name;
                        }
                    }
                }
                 //console.log(field.skill.name + " " + field.skill.categorySlug); //all skills
            }
            if (typeof field.skill !== "undefined"){ //if the skill slot isn't blank
                if (field.skill.categorySlug === "primary"){
                    genskill = field.skill.name; //overwrite
                }
                if (field.skill.categorySlug === "secondary"){ //sometimes it's something else.. "force"wiz or "might"barb..
                    mainskill = field.skill.name; //mainskill gets used later in parsetext, dont change teh name! //overwrite
                }
            }
        });

        //if after searching each skill, still no gen or mainskill
        if (typeof genskill === "undefined" || genskill === "reset"){ 
            genskill = result.skills.active[0].skill.name;//defaults to left most button, could default to no? shamans spend in both slots..
            parseskill("primary", result.skills.active[0].skill.description); //redo, since all else must have failed

        }
        if (typeof mainskill === "undefined" || mainskill === "reset"){
            if (typeof result.skills.active[1].skill !== "undefined"){
                mainskill = result.skills.active[1].skill.name;//default to right mouse button
                parseskill("secondary", result.skills.active[1].skill.description);
                if (typeof result.skills.active[1].rune !== "undefined"){ //check for rune in second slot
                    parseskill("secondary", result.skills.active[1].rune.description); //parse its description
                    mainskillrune = result.skills.active[1].rune.name; //record name for last paragraph
                }
            }
            else
                mainskill = "Sorry."; //Couldn't find a main skill or a skill in 2nd slot.
        }

        //TODO strange passives/skills
        //Static array of possible buff names and values for each class
        //possible options are Bonus damage, as decimals. AttackSpeed, (crit)Chance, and (crit)Damage as whole numbers
        wizbonus = {"Active" : {"Magic Weapon" : {"Bonus" : .1}}, 
                    "Runes" : {"Sparkflint" : {"Bonus" : .1}, "Force Weapon" : {"Bonus" : .1}, "Pinpoint Barrier" : {"Chance" : 5}, "Deep Freeze" : {"Chance" : 10}, "Time Warp" : {"Bonus" : .1}, "Stretch Time" : {"AttackSpeed" : 10}}, //FW is .2, addtl bonus portion is only .1
                    "Passive" : {"Glass Cannon" : {"Bonus": .15}, "Conflagration" : {"Chance" : 6}, "Cold Blooded" : {"Bonus" : .1}, "Audacity" : {"Bonus" : .15}, "Elemental Exposure" : {"Bonus" : .2}}
        }; 
        witbonus = {"Active" : {"Big Bad Voodoo" : {"AttackSpeed" : 20}},
                    "Runes" : {"Slam Dance" : {"Bonus" : .3}},
                    "Passive" : {"Pierce the Veil" : {"Bonus" : .2}} //Gruesome Feast, +10% int, stacking 5 times 
        }; 
        monbonus = {"Active" : {"Mantra of Conviction" : {"Bonus" : .133}}, //Sweeping Wind, 30-90% weapon damage at all times crits and etc?, MoC includes active, 3s/15s +10%
                    "Runes" : {"Overawe" : {"Bonus" : .6} }, // Epiphany - Inner Fire, 353% weapon dmg, 15s/60s.
                    "Passive" : {"Unity" : {"Bonus" : .15}, "Mythic Rhythm" : {"Bonus" : .1}, "Combination Strike" : {"Bonus" : .05}} //mythic, 40% but 3 other attacks in between that don't get a bonus..
        }; 
        dembonus = {"Active" : {},
                    "Runes" : {"Wolf Companion" : {"Bonus" : .1}}, //archery, depends on weapon type..
                    "Passive" : {"Ambush" : {"Bonus" : .1}, "Steady Aim" : {"Bonus" : .2}, "Cull the Weak" : {"Bonus" : .2}, "Single Out" : {"Chance" : 2.5}} //Single Out is basically bosses only, did 1/10..
        }; 
        crubonus = {"Active" : {"Laws of Valor" : {"AttackSpeed" : 9.66}, "Akarat's Champion" : {"Bonus" : .35}}, //valor is act/pass combined, akarat is 2/9s
                    "Runes" : {"Critical" : {"Damage" : 11.11}, "Resolved" : {"Chance" : 24}, "Hasteful" : {"AttackSpeed" : 15}}, //Resolved is weird n this is best case scenario..
                    "Passive" : {"Fervor" : {"AttackSpeed" : 15}} //Finery, "clvl" str per gem... how does Holy Cause work? Blunt may sometimes apply..
        }; 
        barbonus = {"Active" : {"Battle Rage" : {"Bonus" : .10, "Chance" : 3}, "Wrath of the Berserker" : {"AttackSpeed" : 15, "Chance" : 6}}, //wrath 20/120
                    "Runes" : {"Marauder's Rage" : {"Bonus" : .05}, "Insanity" : .3}, //ins 20/120
                    "Passive" : {"Ruthless" : {"Bonus" : .12}, "Brawler" : {"Bonus" : .2}} //Weapons Master, depends on weapon type. Rampage.. 1% str up to 25 times..
        }; 

        classarrayname = classname.slice(0,3) + "bonus";

        //for each active skill
        $.each(result.skills.active, function(count, field){ //check each active skill
            if (typeof field.skill !== "undefined") { //error checking empty slot
                $.each(window[classarrayname].Active, function (namecheck, val){ //check the Active names
                    if(field.skill.name === namecheck){ //we got a match
                        $("#outputact").append("<a href='http://" + g_host + ".battle.net/d3/en/class/" + classname + "/active/" + field.skill.slug + "' onclick='return false;'>" + namecheck + "</a><br>");
                        if (typeof val.Bonus !== "undefined")  {total.Bonus += val.Bonus;} //add to total bonus if exists
                        if (typeof val.Chance !== "undefined") {total.Chance += val.Chance;} //add to total chance if exists
                        if (typeof val.Damage !== "undefined") {total.Damage += val.Damage;} //add to total damage if exists
                        if (typeof val.AttackSpeed !== "undefined") {total.AttackSpeed += val.AttackSpeed;} //add to total aspd if exists
                    }  
                }); //eo active names
                $.each(window[classarrayname].Runes, function (namecheck, val){ //check the Rune names
                    if (typeof field.rune !== "undefined"){ //no rune error check
                        if(field.rune.name === namecheck){
                            $("#outputrune").append("<a href='http://" + g_host + ".battle.net/d3/en/class/" + classname + "/active/" + field.skill.slug + "' onclick='return false;'>" + namecheck + "</a><br>");
                            if (typeof val.Bonus !== "undefined")  {total.Bonus += val.Bonus;} //add to total bonus if exists
                            if (typeof val.Chance !== "undefined") {total.Chance += val.Chance;} //add to total chance if exists
                            if (typeof val.Damage !== "undefined") {total.Damage += val.Damage;} //add to total damage if exists
                            if (typeof val.AttackSpeed !== "undefined") {total.AttackSpeed += val.AttackSpeed;} //add to total aspd if exists 
                       }
                    }
                });//eo rune names
            }//eo error check
        }); //eo activeskills check

        //for each passive skill
        $.each(result.skills.passive, function(count, field){
           $.each(window[classarrayname].Passive, function(namecheck, val){
              if (typeof field.skill !== "undefined"){ //not an empty slot
               if (field.skill.name === namecheck){
                   $("#outputpass").append("<a href='http://" + g_host + ".battle.net/d3/en/class/" + classname + "/active/" + field.skill.slug + "' onclick='return false;'>" + namecheck + "</a><br>");
                   if (typeof val.Bonus !== "undefined")  {total.Bonus += val.Bonus;} //add to total bonus if exists
                   if (typeof val.Chance !== "undefined") {total.Chance += val.Chance;} //add to total chance if exists
                   if (typeof val.Damage !== "undefined") {total.Damage += val.Damage;} //add to total damage if exists
                   if (typeof val.AttackSpeed !== "undefined") {total.AttackSpeed += val.AttackSpeed;} //add to total aspd if exists
               }}
           });
        });



        //TODO dpm calculatorshow main spender
        //$("#dpm").append("Spender: " + mainskill + " - " + char.secondary.type);
        //$("#dpm").append("<br>" + "Generator: " + genskill + " - " + char.primary.type);

        //find attribute main type   
        primname = "";    
        switch(result.class)
            {
            case "wizard":
            case "witch-doctor":
              primname = "Intelligence";
              break;
            case "monk":
            case "demon-hunter": 
              primname = "Dexterity";
              break;
            case "barbarian":
            case "crusader":
              primname = "Strength";
              break;
            } 

        //change table name to main primary stat
        $("#row_header td:eq(1)").empty(); //clear old text
        $("#row_header td:eq(1)").append(primname); //add new text

        //change table name to main skill's type
        $("#row_header td:eq(2)").empty(); //clear old text
        $("#row_header td:eq(2)").append(char.secondary.type); //add new text

        //change table name to main skill
        $("#row_header td:eq(4)").empty(); //clear old text
        $("#row_header td:eq(4)").append(mainskill); //add new text
        //and skillspecifictitle
        $("#skillspecifictitle").empty();
        if (typeof mainskillrune !== "undefined"){
            $("#skillspecifictitle").append(mainskillrune + '<a href="" title ="The first two columns are just the spell damage %, the second two are spell % + elemental %" onclick="return false;"><sup>5</sup></a>');
        }
        else {
        $("#skillspecifictitle").append(mainskill + '<a href="" title ="The first two columns are just the spell damage %, the second two are spell % + elemental %" onclick="return false;"><sup>5</sup></a>');
        }
        
       var icount = 0; //trying to deal with async, total items checked
       var realicount = 0; //total items on character

       for (var items in result.items)
       {
           //prettynaming the slots in the table
           var slotname;
           switch(items)
           {
              case "head":
                   slotname = slotnames[0]; //declared as first line in code
                   break;
              case "torso":
                   slotname = slotnames[1]; //declared as first line in code
                   break;
              case "feet":
                   slotname = slotnames[2]; //declared as first line in code
                   break;
              case "hands":
                   slotname = slotnames[3]; //declared as first line in code
                   break;
              case "shoulders":
                   slotname = slotnames[4]; //declared as first line in code
                   break;
              case "legs":
                   slotname = slotnames[5]; //declared as first line in code
                   break;
              case "bracers":
                   slotname = slotnames[6]; //declared as first line in code
                   break;
              case "mainHand":
                   slotname = slotnames[7]; //declared as first line in code
                   break;
              case "offHand":
                   slotname = slotnames[8]; //declared as first line in code
                   break;
              case "waist":
                   slotname = slotnames[9]; //declared as first line in code
                   break;
              case "rightFinger":
                   slotname = slotnames[10]; //declared as first line in code
                   break;
              case "leftFinger":
                   slotname = slotnames[11]; //declared as first line in code
                   break;
              case "neck":
                   slotname = slotnames[12]; //declared as first line in code
                   break;
           }
           //create a blank row and tds
           $("#herotable").append("<tr id='row_" + items + "'>");
           $("#row_"+items).append("<td>" + slotname + "</a></td>"); //fancier name

           for (var i = 0; i < 8; i++) //for each of 8 cells in a row
                {
                    $("#row_"+items).append("<td></td>"); //blank cell for each
                }
           $("#herotable").append("</tr>");

           //add to count for async check
           realicount++;   
       }
       //add blank row to table for totals
        $("#herotable").append('<tr id = "row_totals">'); //totals row
        $("#row_totals").append("<td>Totals</td>");
        for (var i = 0; i < 8; i++) //for each of 8 cells in a row
            {
                $("#row_totals").append("<td></td>"); //blank cell for each
            }
        $("#herotable").append('</tr>'); //close totals row 


       //dualwield... gives 1.339 for areios, weapons of 1.4 and 1.28.. correct based on alternating swing cycles! 2 / (1/x + 1/y)
       total["BaseAttackSpeed"] = result.stats.attackSpeed;

       //initiate special ring variable
       royalring = 0;
       //initiate set item counter
       numsets = -1; //increments at start not end so -1 not 0
       //for each item
       $.each(result.items, function(i,field){
          //check for set ring
          if (field.name === "Ring of Royal Grandeur") //unique ring, reduces required sets by 1
          {
              royalring = 1;
          }
          //get attackspeed - this is the wrong place for this.. it works but its getting overwritten on every item.
          //total["BaseAttackSpeed"] = result.stats.attackSpeed;

          //add tooltip to items table
          var incell = $("#row_" + i + " td:eq(0)").html(); //what's already in the cell, ex "Left Ring"
          var newincell = "<a href='http://" + g_host + ".battle.net/d3/en/" + field.tooltipParams + "' onclick='return false;'>" 
                  + incell + "</a>"; //convert to tooltip ahref
          $("#row_" + i + " td:eq(0)").empty(); //clear old name
          $("#row_" + i +  " td:eq(0)").append(newincell); //add name with tooltip

          //get its paramater and do an api call
          $.getJSON("http://"+g_host+".battle.net/api/d3/data/"+field.tooltipParams+"?callback=?",
          function(textresult) {  
                //for each item primary attributes
                $.each(textresult.attributes.primary, function(j, textfield){
                   parsetext(textfield, i); 
                });  //eo each primary attr text field 


                if (i === "mainHand" || i === "offHand"){ //for weapons/offhands only
                    if (typeof textresult.minDamage !== "undefined"){ //only if there is a min damage to find (ie not source/offhand/shield)
                    total["Mindmg"] += textresult.minDamage.min; //adds base, non-elemental or attribute damage
                    //console.log(textresult.minDamage.min);
                    }
                    if (typeof textresult.maxDamage!== "undefined") {
                        //console.log(textresult.maxDamage.min);
                    total["Maxdmg"] += textresult.maxDamage.min; //same
                    }
                }

                /* this gets total dps, doesnt work for sources and won't pull element types later
                if (typeof textresult.dps !== "undefined"){ //find weapon averagedps, should work for mainhand/offhand weapons,not sources...
                    total.Avgdmg = (textresult.dps.min)/(textresult.attacksPerSecond.min);
                    console.log(total.Avgdmg);
                }
                */

                //for gems in item 
                $.each(textresult.gems, function(k, textfield) { 
                    //some gems have no primary, they aren't stats, they're effects. i.e. if in helm or weapon 
                    if (typeof textfield.attributes.primary[0] !== "undefined")
                    {
                        //console.log(textfield.attributes.primary[0].text);
                        parsetext(textfield.attributes.primary[0], i); //like +220 int
                    }
                    if (typeof textfield.attributes.secondary[0] !== "undefined")
                    {
                        //console.log(textfield.attributes.secondary[0].text);
                        parsetext(textfield.attributes.secondary[0], i); //like "Increases Bonus Experience by 35%"
                    }

                });  //eo gems

                //for sets, add to total array and check for meeting requirements later
                if (textresult.displayColor === "green") //if we found a set item
                    {                                  
                        if (total.Sets[textresult.set.name] > 0) //second or greather item
                            {
                                total.Sets[textresult.set.name] += 1; 
                            }
                        else //first time
                            {
                                numsets++; //increment to new number of set items
                                total.Sets[numsets] = {}; //initiate new nest object
                                total.Sets[numsets].name = textresult.set.name; //store name in object
                                total.Sets[textresult.set.name] = 1; //for checking item count 
                                $.each(textresult.set.ranks, function(n, rank){
                                    total.Sets[numsets].ranks = {};
                                    total.Sets[numsets].ranks = textresult.set.ranks;
                                });  
                            } 
                    }

                //asynchronisity - this might be really slow.. checks all data of every item
                $.each(textresult, function(l, somethingggg) { //actual value is irrelevant, only counting something every item has
                    //increase itemcount
                    if (l === "itemLevel")
                        {
                            icount++;
                            return false; //will "break" the .each() function!
                            //break itemcountingloop;
                            //break; uncomment for speedup? you can add labels and break by levels!
                            //break b/c itemLevel is like 4th term, don't need to keep going after taht.
                        }
                });

          //Wait until all items checked
          if (icount === realicount) //if all items to be checked, have been checked
              {
                 //check sets
                 $.each(total.Sets, function(p, field){
                     if(total.Sets[field.name] >= 2) //only check at least 2 pieces
                         {
                             var achdranks = total.Sets[field.name] + royalring; //qualifies for rank achdranks

                             $.each(field.ranks, function(p, rank){ //for each rank, check required number against achd number
                                 if (achdranks >= rank.required) {//if we qualify, check secondary and primary attribs
                                     if (typeof rank.attributes.primary[0] !== "undefined"){
                                         $.each(rank.attributes.primary, function(q, attrib){
                                             parsetext(attrib);
                                         });
                                     }//eo primary
                                     if (typeof rank.attributes.secondary[0] !== "undefined"){
                                         $.each(rank.attributes.secondary, function(q, attrib){
                                             parsetext(attrib);
                                         });  
                                     }//eo secondary      
                                 } //eo qualify
                             }); //eo ranks in set
                         } //eo check 2
                 }); //eo each setname in total array

                //manually add in each total
                //TODO switch order? crit/dmg/aspd then elite then skill/element
                $("#row_totals td:eq(1)").append(total["Primary"]);
                $("#row_totals td:eq(2)").append(total["Elementp"][char.secondary.type] + "%"); 
                $("#row_totals td:eq(3)").append(total["Elite"] + "%");
                $("#row_totals td:eq(4)").append(total["Skill"] + "%");
                $("#row_totals td:eq(5)").append(total["Chance"] + "%");
                $("#row_totals td:eq(6)").append(total["Damage"] + "%");
                $("#row_totals td:eq(7)").append(total["AttackSpeed"] + "%"); 


                $("#output").append("<br>");

                generatedps("output");
                //show dps, replace with gendps

                /*TESTING - CORRECT
                var cdps = Math.round(avgdmg * pass * aspd * prim * tcrit*100)/100;
                console.log("avg = " + avgdmg + " aspd = " + aspd +  " prim = " + prim +  " crit = " +tcrit + " dps = " + cdps);
                aspd = 1.82; //wrong b/c sets - right now!
                prim = 1 + (8612/100); //wrong b/c 80 paragon
                tcrit = 1 + (.485 * 4.16); //wrong b/c paragon, 42 critd
                pass = 1.15; //wrong b/c passive, glass cannon, also secodnarys like magic weapon
                var cdps = Math.round(avgdmg * pass * aspd * prim * tcrit*100)/100;
                cdps = cdps.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); //add commas
                console.log("avg = " + avgdmg + " aspd = " + aspd +  " prim = " + prim +  " crit = " +tcrit + " dps = " + cdps);
                */
               
                //Suggest best usage of paragon points
                paragonsuggest(result.paragonLevel);
                
                var skillname;
                if (typeof mainskillrune !== "undefined"){skillname = mainskillrune;}
                else {skillname = mainskill;}

                //Do calculations for main skill
                $("#skillspecific").append(mainskill + " gets " + total.Skill + "% increase. As " + skillname + ", it's element is " + char.secondary.type + ", and it gets " +
                total.Elementp[char.secondary.type] + "% damage bonus from " + char.secondary.type + " and it's weapon damage is " + char.secondary.damage + 
                "%." );
                var modifydpsby = (char.secondary.damage/100) * (1 + (total.Skill/100)); //ex 393/100 = 3.93 and 1 + 27/100 = 1.27
               
                generatedps("skillspecific", modifydpsby);
                
                
                //TODO compare
                //dpsee is the FINAL dps for elites and elemental. its rift boss dmg, and used for compare.
                var dpsee = ((total.Mindmg + total.Maxdmg)/2) * total.Bonus * (total.BaseAttackSpeed *(1+(total.AttackSpeed/100))) * (1+((total.Primary)/100)) *
                (1 + ((total["Damage"]/100)*(total["Chance"]/100))) * ((1 + (total["Elite"]/100)) * (1 + (total["Elementp"][char.secondary.type]/100))) * 
                ((char.secondary.damage/100) * (1 + (total.Skill/100)));
                //console.log(dpsee); 
                
                
                
                //for each row
                
                    //duplicate arrays that are getting changed
                    var changedtotal = total;
                    var changedchar = char;
                    //console.log(changedtotal.Mindmg + " = " + total.Mindmg);
                /* TODO commented while working on dmg
                    //set default values of chprim chele chel chskill chchance chdamage chaspd to 0
                    var chprim = chele = chel = chskill = chchance = chdamage = chaspd = 0; //are they equal to each other or to 0... 0!
                    //for each column
                    $("#herotable tr").each(function(a,b,c,d){ //a is a count, b is some object..
                        console.log(a + " = " + b);
                        $(this).find('td').each(function(a,b){
                            if ($(this).context.innerHTML > 0){
                                console.log("column = " + a); //this is the right column!!
                                console.log($(this).context.innerHTML); //.innerHTML but gives undefined..
                            }
                        });
                    });
                     */
  
//  //TODO start here: first try to get values from tds, then rearrange the .each functions to their
//      //proper comments. add values to the functions so you can find the name of rows to add to. make a big declaration copying 
//      //"var dpsee" from above, using -chprim or other var names to get the changed values.
                        //find number in cell

                        //and subtract it from the relevant value
                        
                    //after all columns complete, recalculate dps
                    var changeddps = 9000000;
                    var changepercent = 100*(dpsee - changeddps)/dpsee;
                    //and convert to two digits
                    changepercent = changepercent.toFixed(2);
                    //and add to that row
                    $("#row_mainHand td:eq(8)").append(changepercent + "%");
                    
                //at end of this, highlight lowest contributing piece?

               //TODO LIST:
               
               //change Mindmg in total array, parsetext, and some dps calculations, shouldn't be too hard, but:
                    //new subobject with element types, for each min and max? 
                        //for each element min, add min and max, div by 2, times by 1+elementp, add to totaldamage (add all, some will be 0)
                    //if slot == offhand, then duplicate-add to total.offhand.min and total.offhand.max - always non-elemental??? use later for button, remove this amount and add button amount
               
               //double-clicking same hero icon, quickly, doesn't clear! no clue how to solve that except maybe a wait function before responding again? or state variable?
               
               //mainskill as option
               //offhand overwrite option

               //all char display option
               
               //Contribute? dps with item and dps without item, find difference. 150 dps to 100 dps, (x-y)/x.
                    //for each table row, duplicate total array and find dps (e+e) and subtract row stats, then ^
               //switch cold and elite in table?
               //not exactly a dps calculator, its a damage per cast calculator. dps is not a useful thing to know, but dpm or dprotation would be.
        

               //general stuff from faq...
               //X          passives
               //X          dualwield
               //unique bonuses, ex hexing pants of mr yan :  dmg and regen inc by 25%

               //reforge suggestions - reduce move speed, max stats, trifecta, etc.

               //X          google analytics
               //X          content background image, wait to get final height and make content that height in css
               //X          prettify: buttons, hovers and notes, etc.
               
               //Faq, about, contact pages



              }                    
          }); //eo get items json                   
       }); //eo each item
    }); //eo get char result json function
} //eo loadchar

//parses text fields for crit chance, damage, intelligence, etc.
function parsetext(field, slot){
    //parse by spaces
    var parts = field.text.split(" ");  //***whatever you sent in field, next . has to be .text
    //
    //CRITS
    //if first value is "critical", check 2th index for "damage" or "chance", use 5th value for #, remove percent
    if (parts[0] === "Critical" && parts[1] === "Hit" && parts[2] === "Chance") //hits would give ap on crit, fury on crit, etc.
        {
            var critvalueasString = parts[5].replace("%", ""); //replace % with space/nothing?
            var critvalueasNumber = parseFloat(critvalueasString); //convert back to a float
            total["Chance"] += (critvalueasNumber); 
            $("#row_" + slot +  " td:eq(5)").append(critvalueasNumber); //5 for chance
        }

    //CRIT DAMAGE 
    if (parts[0] === "Critical" && parts[1] === "Hit" && parts[2] === "Damage") //hits would give ap on crit, fury on crit, etc.
        {
            var critvalueasString = parts[5].replace("%", ""); //replace % with space/nothing?
            var critvalueasNumber = parseFloat(critvalueasString); //convert back to a float
            total["Damage"] += (critvalueasNumber); 
            //for gems
            var incell = $("#row_" + slot + " td:eq(6)").html(); //what's already in the cell
            if (incell === "")
                {
                    $("#row_" + slot +  " td:eq(6)").append(critvalueasNumber); //1 for primary
                }
            else {
                incell = parseFloat(incell); //change in cell to number
                var newtot = incell + critvalueasNumber; //add them
                $("#row_" + slot + " td:eq(6)").empty(); //clear old number
                $("#row_" + slot +  " td:eq(6)").append(newtot); //add new total
            }  



        }


    //PRIMARY set by class - global primname
    if (parts[1] === primname)
        {
            var primasString = parts[0].replace("+", ""); //replace % with space/nothing?
            var primasNumber = parseFloat(primasString); //convert back to a float
            total["Primary"] += (primasNumber); //was parts[1]
            //for gems
            var incell = $("#row_" + slot + " td:eq(1)").html(); //what's already in the cell
            if (incell === "")
                {
                    $("#row_" + slot +  " td:eq(1)").append(primasNumber); //1 for primary
                }
            else {
                incell = parseFloat(incell); //change in cell to number
                var newtot = incell + primasNumber; //add them
                $("#row_" + slot + " td:eq(1)").empty(); //clear old number
                $("#row_" + slot +  " td:eq(1)").append(newtot); //add new total
            }  
        }

    //ATTACK speed increase - "Attack Speed Increased by 5.0%"
    if (parts[0] === "Attack" && parts[1] === "Speed")
        {
            var aspdasString = parts[4].replace("%", ""); //replace % with space/nothing?
            var aspdasNumber = parseFloat(aspdasString); //convert back to a float
            total["AttackSpeed"] += (aspdasNumber);
            $("#row_" + slot +  " td:eq(7)").append(aspdasNumber); //7 for aspd
            /*plus 8% from set piece of cains!*/
        }

    //DAMAGE - nonelemental, or elemental, and NOT crit    /*****this is only for elemental damage on weapons, for later patches****             
    if (parts[1] === "Damage" || parts[2] === "Damage" && parts[1] !== "Hit" && parts[0] !== "Increases") // || parts[1] === "Damage" for non elemental
        { //issue with red gems
            console.log(parts[1]); //TODO weapon's element type might matter in a later patch.. 5.0.2 but not sure?
                //looks like asof 5.0.2 % cold will affect the +cold on weapons so it needs to be added to dps{} separately? or was it already included?
            var dmgs = parts[0].split("–"); //0 is +min, 1 is max... not a hyphen! weird.

            var mindmgasString = dmgs[0].replace("+", ""); //remove + from min damage
            var mindmgasNumber = parseFloat(mindmgasString);
            total["Mindmg"] += (mindmgasNumber);

            
            //if dmgs1 exists, add it, otherwise re-add dmgs0 <- this case is a red gem, flat add to both numbers.
            if (typeof dmgs[1] !== "undefined") {
                var maxdmgasNumber = parseFloat(dmgs[1]);
                total["Maxdmg"] += (maxdmgasNumber);
            }
            //Red Gems in weapons
            if (typeof dmgs[1] === "undefined"){
                total["Maxdmg"] += (mindmgasNumber); //repeat, re-add min gem amt to max dmg
            }
        }

    //ELEMENTAL damage %
    if (parts[1] === "skills" && parts[0] === char.secondary.type)
        {
            var prcasString = parts[3].replace("%", "");
            var prcasNumber = parseFloat(prcasString);
            total["Elementp"][parts[0]] += prcasNumber;
            $("#row_" + slot +  " td:eq(2)").append(prcasNumber); //2 for elements
        }

    //SKILL specific damage %    
    //skname1 is just parts[1]
    var skname2 = parts[1] + " " + parts[2]; 
    var skname3 = parts[1] + " " + parts[2] + " " + parts[3]; 
    var skname4 = parts[1] + " " + parts[2] + " " + parts[3] + " " + parts[4]; 
    ////only works for skills with two words.. 1 2 3 or 4..,"seven-sided strike" =2?, "hammer of the ancients"
    if ((parts[0] === "Increases") && (parts[1] === mainskill || skname2 === mainskill || skname3 === mainskill || skname4 === mainskill))
        { 
            //tougher to find % here, cant just pick a parts. always ends in %?
            //split by (
            var strparts = field.text.split("(");
            //take last 4 digits
            var last4 = strparts[0].substr(strparts[0].length - 4); // => "Tabs1"
            //remove % sign
            var skillasString = last4.replace("%", "");
            //convert to number
            var skillasNumber = parseFloat(skillasString); 
            total["Skill"] += skillasNumber;
            $("#row_" + slot +  " td:eq(4)").append(skillasNumber); //4 for skills           
        }

    //ELITE damage %    
    if (parts[3] === "elites" && parts[0] === "Increases") //inc because also reduces is an option
        {
            var eliteasString = parts[5].replace("%", "");
            var eliteasNumber = parseFloat(eliteasString);
            total["Elite"] += eliteasNumber;
            $("#row_" + slot +  " td:eq(3)").append(eliteasNumber); //3 for elite
        }

    //MOVE speed
    if (parts[1] === "Movement")
        {
            var moveasString = parts[0].replace("%", "");
            var moveasNumber = parseFloat(moveasString);
            total["Move"] += moveasNumber;
        }

}//eo parsetext

function parseskill(slot, desc) { //prim or second, and text description
    //find the element type and assign to object
    if (desc.indexOf("Power") <= 20 && desc.indexOf("Power") !== -1){ //ex "Cost: 20 Arcane Power" <= 20 will give -1 if not there
     desc = desc.substring(20);
    }

    $.each(total.Elementp, function(element){ //element comes from total array names, just be careful
        if (desc.indexOf(element) >= 0){ //Arcane "Power" is a thing though..
        //if(desc.indexOf("Power") <= 20) {//not found? Yeah! or at least close enough, 20 chars or so to avoid ones with "power" in cost
            char[slot].type = element;
        }  
    });

    //find the percentage and assign to object
    var matches = desc.match(/[0-9]*\.?[0-9]+%/); // regexp to get only the number with %, may need some testing
    if (matches !== null) {
        matches[0] = matches[0].replace("%", "");
        char[slot].damage = matches[0];
    }
}

function paragonsuggest(totallevel){

var tp1 = tp2 = tp3 = tp4 = Math.floor(totallevel/4);
var leftoverpara = totallevel%4;
for (var i = 0; i < leftoverpara; i++){
eval("tp" + (1 + i) + " += 1");
//window['tp' + 1 + i] += 1; //wont work because these aren't global variables
}

$("#paragon1").append("You have " + tp1 + " points to spend in Core attributes. "); //while still full
$("#paragon2").append("<br> You have " + tp2 + " points to spend in Offensive attributes."); 

//core - reach softcap for move speed then sink into primary
var addprim = 0;
var addmove = 0;

while (total["Move"] < 25 && addmove < 50){
tp1 -= 1;
total["Move"] += .5; //stat change
addmove += 1; //points spent
}
while (tp1 > 0 && addprim < 50){ //max of 50 points in a category
tp1 -= 1;
total.Primary += 5; //stat change
addprim +=1; //points spent
}

addmove = addmove.toFixed(0);
addprim = addprim.toFixed(0);

$("#paragon1").append("You should spend <span style='color:white; font-weight: bold'>" + addmove + "</span> points in Move Speed to reach the soft cap of 25%. ");
$("#paragon1").append("Then spend <span style='color:white; font-weight: bold'>" + addprim + "</span> points in " + primname + ". ");
//$("#paragon1").append("Doing so will give you dps as follows: ");
//generatedps("paragon1"); //location to output


//offense - 1% chance = 10% damage
var addchance = 0; //by .1
var adddamage = 0; //by 1
var addspeed = 0; //by .2


while (tp2 > 0){
if (total["Chance"] > total["Damage"]/10 && adddamage < 50 && tp2 > 0){ //small damage and not maxed category and points to spend
tp2 -=1;
total["Damage"] += 1;
adddamage += 1;
}
if ((total["Chance"] <= total["Damage"]/10 || adddamage === 50 ) && addchance < 50 && tp2 > 0){ //small crit or maxed damage, not maxed cat, points to spend addchance 5 b/c div by 10.
tp2 -=1;
total["Chance"] += .1;
addchance += 1;
}
if (addchance === 50 && adddamage === 50 && addspeed < 50 && tp2 > 0){ //other two maxed, points to spend
tp2 -=1;
total["AttackSpeed"] += .2;
addspeed += 1;
}
if (addchance === 50 && adddamage === 50 && addspeed === 50 ) { 
tp2 = 0; //set to 0 so while loop stops if they have over 150 points.
} 
}


adddamage = adddamage.toFixed(0);
addchance = addchance.toFixed(0);

$("#paragon2").append("You should spend <span style='color:white; font-weight: bold'>" + adddamage + "</span> points in Critical Hit Damage and <span style='color:white; font-weight: bold'>" + addchance + "</span> points in Critical\n\
Hit Chance. <span style='color:white; font-weight: bold'>" + addspeed + "</span> points should go into Attack Speed. ");
$("#paragon2").append("<br>Spending your points this way will give you dps as follows:"); 
$("#paragon2").append("<a href='' title ='The base value in this table should be your sheet dps in-game. If not, it&#39;s Blizzard&#39;s fault with incorrect offhand damage.' onclick='return false;'><sup>*</a></sup>");
generatedps("paragon2");


}

function generatedps(location, a){ 
//TODO: this function should create a new duplicate array every time it's called, and compare that duplicate to the original
//for percent increases. new array all times except when location is output? OR new sub arrays in "dps{}"!!!
a = typeof a !== 'undefined' ? a : 1; //if a is given, use it, otherwise use 1. optional parameter for spells

$("#" + location).append("<br>"); //spacing 

//var avgdmg = ((1224+269) + (1648+300))/2;
//var mini = 1224+269;//1305+ 275; izpz numbers and mine
//var maxi = 1648+300;//1730+ 296; izpz numbers and amine

//TODO option to fix these. need a text box and record offhand damage separately in total array so it can be removed/replaced.
var avgdmg = (total.Mindmg + total.Maxdmg)/2;
//(total["Mindmg"] + total["Maxdmg"])/2; //incorrect because of flaw in armory

var pass = total.Bonus; //s/b 1, and get fixed was 1.15 for correct character sheet damage
var aspd = total.BaseAttackSpeed *(1+(total.AttackSpeed/100)); //1.4 * 1.3 correct  //sb total.BaseAttackSpeed
var prim = 1+((total.Primary)/100); 
var tcrit = 1 + ((total["Damage"]/100)*(total["Chance"]/100));
//console.log("avg = " + avgdmg + " aspd = " + aspd +  " prim = " + prim +  " crit = " +tcrit);                         

var dps = {}; //create dps array

dps.Base = avgdmg * pass * aspd * prim * tcrit * a; //a is a special modifier
dps.Elite = dps.Base * (1 + (total["Elite"]/100));
dps.Elemental = dps.Base * (1 + (total["Elementp"][char.secondary.type]/100)); //get only spender's element
dps.EliteElemental = dps.Base * (1 + (total["Elite"]/100)) * (1 + (total["Elementp"][char.secondary.type]/100));

/*
var dpsee = ((total.Mindmg + total.Maxdmg)/2) * total.Bonus * (total.BaseAttackSpeed *(1+(total.AttackSpeed/100))) * (1+((total.Primary)/100)) *
(1 + ((total["Damage"]/100)*(total["Chance"]/100))) * ((1 + (total["Elite"]/100)) * (1 + (total["Elementp"][char.secondary.type]/100))) * 
((char.secondary.damage/100) * (1 + (total.Skill/100)));
console.log(dpsee);
*/

//table, normal, elite, elemental, el/el along the top
//dps - sheet
//dpcast - main spell, no attack speed

//dpap - from max resource to empty.. tough calculating max resource..
//dpm - ^
//along the side?

//create a table
$("#" + location).append("<table class = 'dps' id = 'table" + location + "'>");
$("#table" + location).append("<tr id ='" + location + "header'>");
//display header
$.each(dps, function(name){ //fill the header row
    $("#" + location + "header").append("<td>"+name+"</td>");
});
$("#table" + location).append("</tr>");

$("#table" + location).append("<tr id ='" + location + "body'>");
//display each dps
$.each(dps, function(name, value){
    //get % increase over sheet dps
    var increase = ((value/dps.Base)*100).toFixed(0);
    //shorten to 0 decimals
    value = (Math.round(value*100)/100).toFixed(0);
    //add commas
    value = value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    //append to table - info
    $("#" + location + "body").append("<td>"+value+"</td>");

    //$("#" + location).append(name  + " DPS: " + value + " (" + increase + "%)"); //increase percent isn't hugely useful...
});

$("#table" + location).append("</tr>");

$("#" + location).append("</table>"); //close table

} //eo generatedps function

//clear all output
function clearoutput(){
    //clear text in output
    $("#output").html('');
    $("#output").append('<div id ="outputact"> </div><div id ="outputpass"> </div><div id ="outputrune"> </div>'); //reappend the styling for skill tooltips
    $("#paragon1").html('');
    $("#paragon2").html('');
    $("#skillspecific").html('');
    $("#skillspecific").append('<h2 id ="skillspecifictitle">Skill Specific<a href="" title ="The first two columns are just the spell damage %, the second two are spell % + elemental %" onclick="return false;"><sup>*</sup></a></h2>');
    //clear table
    $("#herotable").find("tr:gt(0)").remove(); 
    //reset main combat skills. blank wont work so reset is a specific term used later
    genskill = mainskill = "reset";
}

//ON DOM LOAD
$(document).ready(function() { 
    //handles the profile click/submit event
    $('#submitprof').click(function() {
        loadprofile($('#host').val(), $('#name').val(), $('#code').val() );
    }); 
});


