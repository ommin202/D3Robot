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

var offhandflag = 0;
var g_host, g_name, g_code, g_id; //make all function variables global, so they can be re-accessed
var slotnames = ["Helm", "Chest", "Boots", "Gloves", "Shoulders", "Legs", "Bracers", "Main Hand", "Off Hand", "Belt", "Right Ring", "Left Ring", "Amulet"];

//load the characters from profile
function loadprofile(host, name, code) //gets the profile json
{ 
    //make variables to globals
    g_host = host;
    g_name = name;
    g_code = code;
    
    //to stop doubleclick
    clickableheroes = true;

    clearoutput();
    $("#profileform").after('<h2 id = "h2heroes">Heroes<a href="" title ="Only your first 9 Heroes are listed. If you want to view info for other characters move them up the list in-game." onclick="return false;"><sup>*</sup></a></h2>');
    
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
            //if there's a failure
            if (result.code === "NOTFOUND"){
                alert(result.reason);
            }
            //go through each hero and create their box
            $.each(result.heroes, function(i, field){ //key, value
                var curcb = "#cb" + i; //easier id of current character block
                //find icon string and put it in block, make block visible
                var icon = (field.class).slice(0,3) + field.gender; //first 3 plus gender is filepath for icon
                document.getElementById("cb"+i).getElementsByTagName("img")[0].src = "img/portraits/"+icon+".jpg"; //change box image
                $(curcb).css('visibility', 'visible');
                //change a name and link  
                $(curcb).children('a').attr("title", field.name + ", " + field.level); //hover                       
                $(curcb).children('a').click(function(a,b){
                    if(clickableheroes === false){ //if still busy loading, return right away and do nothing
                        console.log(clickableheroes);
                        return;
                    }
                    clickableheroes = true; //set to default here
                    loadchar(field.id); 
                    //set all borders to orange (was black at 000)
                    $(charboxes).children('div').css("border-color", "#fa761e");
                    //set current one to white
                    $(curcb).css("border-color", "#F3E6D0");
                    //set class variable to current
                    classname = field.class;
                    heroname = field.name;
                    //disable multiclicking
                    //console.log(a);
                    
                    
                });  
                

            }); //end of each  
            //$("#output").append("Last Hero Played: " +result.lastHeroPlayed+ "<br>"); //doesnt always return..
        }); //eo result
};    //eo loadprofile

//loads the items/skills from selectd hero
function loadchar(id)
{
    clickableheroes = false;
    clearoutput(); 
    $("#charboxes").after("<h3 id = 'loading'>Loading...</h2>");
g_id = id; //make id global, not required?
  
var offhandmin = 0; 
var offhandmax = 0;

//if offhand info already set, for rerunning offhand
if (typeof total !== "undefined"){ //so no errors on first run; when total already exists
    //for offhand
    if (total.Offhand.Mindmg > 0 && offhandflag === 1){ //dmg exists (from either old char or this) & we just ran changeoffhand
        //console.log("offhand rerun");
        //rerunning the whole code will add the wrong dps, so we need to subtract that in advance, AND add the replacement
        var offhandmin = total.Offhand.Mindmg;
        var offhandmax = total.Offhand.Maxdmg;
        offhandflag = 0; //set back to 0 when done.
    }
    else { //no offhandflag, loading character like normal.
        var offhandmin = 0;
        var offhandmax = 0;
        //set to future base values
        //console.log("loading 2nd+ char or reloaded");
    }
}
//basic total stuff
window.total = {"Primary" : 7, "Elite" : 0, "Skill" : 0, "Chance" : 5, "Damage" : 50,  "AttackSpeed" : 0, "Avgdmg" : 0,
                "Move" : 0, "BaseAttackSpeed" : 1, "Bonus" : 1, "Mindmg" : offhandmin, "Maxdmg" : offhandmax, "ParagonLevel" : 0 ,
                "Offhand" : {"Mindmg" : offhandmin , "Maxdmg" : offhandmax } , //ignore this for now
                "Mainhand" : {"Mindmg" : 0 , "Maxdmg" : 0} , //both these were 0
    "Elementp" : {"Fire" : 0, "Lightning" : 0, "Cold" : 0, "Holy" : 0, "Poison" : 0, "Arcane" : 0, "Physical" : 0} ,
    "Sets" : {}}; //initialize total stats array
window.char = {"primary" : {"type" : "Physical", "damage" : 0} , "secondary" : {"type" : "Physical", "damage" : 0}}; //character array
window.allraw = {}; //all raw item data is in here
//console.log(total);

//double checking offhand, because its a trouble with being run first or second and diff characters
//so again..
    if (typeof total.Offhand === "undefined"){//haven't loaded first character, there's no offhand to check
        total.Offhand = {"Mindmg" : 0 , "Maxdmg" : 0}; //set to base values
        total.Mindmg = 0;
        total.Maxdmg = 0;
        //console.log("loaded first/new char");
    }

    if (total.Offhand.Mindmg > 0){//no worry about offhandflag now, no other way for mindmg to exist at this point
        //console.log("offhand data from before is still here!");
    }



/*TODO WATCH - object.watch("subthing to watch", 
    total["Mainhand"].watch("Maxdmg", function (id, oldval, newval) {
    console.log( "total." + id + " changed from " + oldval + " to " + newval );
    return newval;
    });
*/

//append the full table to the page
$("#hero").append('<h2>Items<a href="" title ="The totals for this table contain values from set bonuses and gems, though they aren&#39;t listed individually." onclick="return false;"><sup>*</sup></a></h2><table id ="herotable"><tr id ="row_header"><td>Slot</td><td>Primary</td><td>Elemental</td><td>Elite</td><td>Skill</td><td>Crit Chance</td><td>Crit Damage</td><td>Attack Speed</td><td>Increase<a href="" title ="This column finds the % contribution to your damage from each item, but doesn&#39;t include set bonuses." onclick="return false;"><sup>*</sup></a></td></tr></table>');
//and show base numbers, a few lines below



//char defaults to physical to prevent NaN
//primary has a base of 7, then add gear, no way to add paragon!
//Chance and Damage are for crit, have basses of 5 and 50
//fire, lightning, cold, holy, poison, arcane and physical
$.getJSON("http://"+g_host+".battle.net/api/d3/profile/"+g_name+"-"+g_code+"/hero/"+id+"?callback=?",
    function(result) {  
        primperlevel = parseFloat(result.level)*3; //3 per level including 1st level
        primforshow = primperlevel + 7;
        //show base stats in table
        $("#herotable").append('<tr id ="row_base"><td>Base</td><td>'+primforshow+'</td><td></td><td></td><td></td><td>5</td><td>50</td><td></td><td></td></tr>');

        total.Primary += primperlevel; //plus base of 7 from before
        $.each(result.skills.active, function(count, field){
            //create blank array for each skill
            char[count] = {"name" : 0, "runename" : 0 , "damage" : 0, "type" : 0, "skill" : 0  }; 
            
            //parse all skills, gen and main will be duplicated.
            if (typeof field.skill !== "undefined"){
                parseskill(count, field.skill.description);
                char[count].name = field.skill.name; 
            }
            if (typeof field.rune !== "undefined"){
                parseskill(count, field.rune.description);
                char[count].runename = field.rune.name; 
            }
            
            
            //regular/old method of finding skills.
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
        

        //After auto-searching for runes, fix strange ones. after meteor is patch 2.0.5
        if (typeof mainskillrune !== "undefined"){
            //TODO Unique skills and runes, if new percent is below old percent because of splitting or something.
            if (mainskillrune === "Meteor Shower"){ 
                char.secondary.damage = 228 * 7; //228% times 7 meteors
                       // console.log(char); 
            }
            //BAR
            if (mainskillrune === "Sidearm"){ 
                char.secondary.type = "Cold"; 
            }
            if (mainskillrune === "Crushing Advance"){ 
                char.secondary.type = "Cold"; 
            }
            if (mainskillrune === "Best Served Cold"){ 
                char.secondary.type = "Cold"; 
            }
            if (mainskillrune === "Hurricane"){ 
                char.secondary.type = "Cold"; 
            }
            if (mainskillrune === "Arreat's Wall"){ 
                char.secondary.type = "Fire"; 
            }
            //CRU
            /*Akarat's Champion is all kinds of messed up*/
            if (mainskillrune === "Divine Aegis"){ 
                char.secondary.type = "Physical"; 
            }
            if (mainskillrune === "Annihilate"){ 
                char.secondary.type = "Fire"; 
            }
            if (mainskillrune === "Mine Field"){ 
                char.secondary.type = "Fire"; 
            
            }if (mainskillrune === "Targeted"){ 
                char.secondary.type = "Holy"; 
            }
            if (mainskillrune === "Reciprocate"){ 
                char.secondary.type = "Fire"; 
            }
            if (mainskillrune === "Shattering Explosion"){ 
                char.secondary.type = "Physical"; 
            }
            if (mainskillrune === "Flurry"){ 
                char.secondary.type = "Holy"; 
            }
            if (mainskillrune === "Rapid Descent"){ 
                char.secondary.type = "Lightning"; 
            }
            if (mainskillrune === "Heaven's Tempest"){ 
                char.secondary.type = "Fire"; 
            }
            if (mainskillrune === "Retribution"){ 
                char.secondary.type = "Holy"; 
            }
            if (mainskillrune === "Thou Shalt Not Pass"){ 
                char.secondary.type = "Lightning"; 
            }
            if (mainskillrune === "Hammer of Pursuit"){ 
                char.secondary.type = "Physical"; 
            }
            if (mainskillrune === "Sword of Justice"){ 
                char.secondary.type = "Physical"; 
            }
            if (mainskillrune === "Fury"){ 
                char.secondary.type = "Lightning"; 
            }
            if (mainskillrune === "Retaliate"){ 
                char.secondary.type = "Holy"; 
            }
            if (mainskillrune === "Crumble"){ 
                char.secondary.type = "Fire"; 
            }
            if (mainskillrune === "One on One"){ 
                char.secondary.type = "Lightning"; 
            }
            if (mainskillrune === "Pound"){ 
                char.secondary.type = "Physical"; 
            }
            if (mainskillrune === "Shield Cross"){ 
                char.secondary.type = "Physical"; 
            }
            if (mainskillrune === "Shared Fate"){ 
                char.secondary.type = "Lightning"; 
            }
            if (mainskillrune === "Draw and Quarter"){ 
                char.secondary.type = "Holy"; 
            }
            if (mainskillrune === "Gathering Sweep"){ 
                char.secondary.type = "Holy"; 
            }
            if (mainskillrune === "Shattering Throw"){
                char.secondary.type = "Holy";
            }
            //DH
            if (mainskillrune === "Devouring Arrow"){ 
                char.secondary.type = "Cold"; 
            }
            //Monk
            if (mainskillrune === "Rising Tide"){ 
                char.secondary.type = "Holy"; 
            }
            if (mainskillrune === "Keen Eye"){ 
                char.secondary.type = "Fire"; 
            }
            if (mainskillrune === "Strike from Beyond"){ 
                char.secondary.type = "Cold"; 
            }
            if (mainskillrune === "Bounding Light"){ 
                char.secondary.type = "Holy"; 
            }
            if (mainskillrune === "Quickening"){ 
                char.secondary.type = "Physical"; 
            }
            if (mainskillrune === "Inner Storm"){ 
                char.secondary.type = "Holy"; 
            }
            if (mainskillrune === "Explosive Light"){ 
                char.secondary.type = "Fire"; 
            } //following rune got a name change too, hmm..
            if (mainskillrune === "Blinding Light" || mainskillrune === "Numbing Light"){ 
                char.secondary.type = "Cold"; 
            }
            if (mainskillrune === "Wall of Light"){ 
                char.secondary.type = "Physical"; 
            }
            if (mainskillrune === "Blazing Fists"){ 
                char.secondary.type = "Fire"; 
            }
            if (mainskillrune === "Hands of Lightning"){ 
                char.secondary.type = "Lightning"; 
            }
            if (mainskillrune === "Spirited Salvo"){ 
                char.secondary.type = "Holy"; 
            }
            //WD
            if (mainskillrune === "Leaping Spiders"){ 
                char.secondary.type = "Poison"; 
            }
            if (mainskillrune === "Medusa Spiders"){ 
                char.secondary.type = "Cold"; 
            }
            if (mainskillrune === "Humongoid"){ 
                char.secondary.type = "Cold"; 
            }
            if (mainskillrune === "Bruiser"){ 
                char.secondary.type = "Fire"; 
            }
            if (mainskillrune === "Toad of Hugeness"){ 
                char.secondary.type = "Poison"; 
            }
            if (mainskillrune === "Bogadile"){ 
                char.secondary.type = "Physical"; 
            }
            if (mainskillrune === "Unrelenting Grip"){ 
                char.secondary.type = "Cold"; 
            }
            //WIZ
            if (mainskillrune === "Arcane Destruction" || mainskillrune === "Combustion"){ 
                char.secondary.type = "Fire"; 
            }
            if (mainskillrune === "Pure Power"){ 
                char.secondary.type = "Lightning"; 
            }
            if (mainskillrune === "Slow Time"){ 
                char.secondary.type = "Cold"; 
            }
            
            
            
            
            
        }//eo strange skills and runes, 2.0.5


        //TODO strange passives/skills
        //Static array of possible buff names and values for each class
        //possible options are Bonus damage, as decimals. AttackSpeed, (crit)Chance, and (crit)Damage as whole numbers
        wizbonus = {"Active" : {"Magic Weapon" : {"Bonus" : .1}}, 
                    "Runes" : {"Sparkflint" : {"Bonus" : .1}, "Force Weapon" : {"Bonus" : .1}, "Pinpoint Barrier" : {"Chance" : 5}, "Deep Freeze" : {"Chance" : 10}, "Time Warp" : {"Bonus" : .1}, "Stretch Time" : {"AttackSpeed" : 10}}, //FW is .2, addtl bonus portion is only .1
                    "Passive" : {"Glass Cannon" : {"Bonus": .15}, "Conflagration" : {"Chance" : 6}, "Cold Blooded" : {"Bonus" : .1}, "Audacity" : {"Bonus" : .15}, "Elemental Exposure" : {"Bonus" : .2}, "Unwavering Will" : {"Bonus" : .1}}
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
        
        //append title to output
        $("#hero").after('<h2>Total from Items/Skills<a href="" title ="Includes runes in data, just not in tooltip. Activated passives are pro-rated. Turn off Paragon points and check &#39;base&#39; here to match your in-game dps. May be off due to Blizzard&#39;s incorrect API, weird passives, or pre 2.0.5 weapons." onclick="return false;"><sup>*</sup></a></h2>');
        $("#output").append('<div id ="outputact"></div><div id ="outputpass"></div><div id ="outputrune"></div>');
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
                            //$("#outputrune").append("<a href='http://" + g_host + ".battle.net/d3/en/class/" + classname + "/active/" + field.skill.slug + "#" + field.rune.type + "' onclick='return false;'>" + namecheck + "</a><br>");
                            //$("#outputrune").append("<a href='http://eu.battle.net/d3/en/class/monk/active/serenity#c'>" + "serenity" +  "</a><br>");
                            //TODO runes on hover
                            //http://{region}.battle.net/d3/{locale}/class/{class}/active/{skill}#{runeLetter}
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

        //TODO if at this point, outputrune and pass and act all have no innerhtml, remove them

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
        //TODO adding the sup below changed the position of totals.. hmm..
        $("#row_totals").append('<td>Totals<a href="" title ="Includes base primary and crit chance and crit damage, set bonuses, and active/passive skills." onclick="return false;"><sup>*</sup></a></td>');
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
       //setup an array to hold legendary texts
       legbonuses = {};
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
                //TODO get all raw data, just to see what's there.
                getAllRaw(textresult.attributesRaw, i);
                
              
                //for each item primary attributes
                $.each(textresult.attributes.primary, function(j, textfield){
                   parsetext(textfield, i, textresult.type.id); //also send in if its an orb, etc. 
                });  //eo each primary attr text field 
 
                
                //TODO get all legendary attributes
                
                var bonusslot = "";
                $.each (textresult.attributes, function(j, textfield){ //prim/sec/pass
                    if (typeof textfield["0"] !== "undefiend"){ //if at least 1
                        $.each(textfield, function(k,field){
                            if (field.color === "orange"){
                                bonusslot = textresult.type.id;
                                legbonuses[bonusslot] = {};
                                legbonuses[bonusslot].text = field.text;
                                legbonuses[bonusslot].name = textresult.name;
                            }
                        });
                    }
                });
                
                
                
                
                
                //gets the base weapon damage, without the element portion
                if (i === "mainHand"){ //for weapons/offhands only
                    if (typeof textresult.minDamage !== "undefined"){ //only if there is a min damage to find (ie not source/offhand/shield)
                        total["Mindmg"] += textresult.minDamage.min; //adds base, non-elemental or attribute damage
                        total["Mainhand"]["Mindmg"] += textresult.minDamage.min;
                    }
                    if (typeof textresult.maxDamage !== "undefined") {
                        total["Maxdmg"] += textresult.maxDamage.min; //same
                        //console.log(total.Mainhand.Maxdmg); //stil wrong..?
                        total["Mainhand"]["Maxdmg"] += textresult.maxDamage.min;  //this was giving an error as +=, something else was making it NaN before even getting here..
                        //console.log(textresult);
                        //console.log("textresult.max.min =" + textresult.maxDamage.min); //this number should be.. 2894?
                        //console.log(total.Mindmg); //just straight up wrong when damage type is physical?
                        
                    }
                }
                //same for offhand - if it's a weapon, if it's not a weapon then the damage is actually a prim attribute and gets parsed
                if (i === "offHand"){ //for weapons/offhands only
                    //console.log(textresult); //this doesn't work, ONLY if type is offhand.
                    if (typeof textresult.minDamage !== "undefined"){ //only if there is a min damage to find (ie not source/offhand/shield)
                        total["Mindmg"] += textresult.minDamage.min; //adds base, non-elemental or attribute damage
                        total["Offhand"]["Mindmg"] += textresult.minDamage.min;
                    }
                    if (typeof textresult.maxDamage!== "undefined") {
                        total["Maxdmg"] += textresult.maxDamage.min; //same
                        total["Offhand"]["Maxdmg"] += textresult.maxDamage.min;
                    }
                }
                /*
                if (textresult.type.id === "Orb" || textresult.type.id === "Mojo" || textresult.type.id === "Quiver") {
                    console.log(textresult.type.id); //"Orb", "Mojo", 
                }
                */

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
                //TODO switch order? crit/dmg/aspd then elite then skill/element, add flat damage?!
                $("#row_totals td:eq(1)").append(total["Primary"]);
                $("#row_totals td:eq(2)").append(total["Elementp"][char.secondary.type] + "%"); 
                $("#row_totals td:eq(3)").append(total["Elite"] + "%");
                $("#row_totals td:eq(4)").append(total["Skill"] + "%");
                $("#row_totals td:eq(5)").append(total["Chance"] + "%");
                $("#row_totals td:eq(6)").append(total["Damage"] + "%");
                $("#row_totals td:eq(7)").append(total["AttackSpeed"] + "%");

                $("#output").append("<br>");
                
                //Change offhand button
                //if there is some offhand damage
                if (total.Offhand.Mindmg > 0){
                    //add text below hero table
                    $("#hero").append("<p id='offhand'>Your offhand damage is listed as +" + total.Offhand.Mindmg + "-" + 
                            total.Offhand.Maxdmg + ". If this is incorrect, <a id='offhandclick'>click here.</a></p>");
                    //add click handler
                    $('#offhandclick').click(function(){ changeOffhand(); return false; });
                }
                
                
                generatedps("output");
                
                //Suggest best usage of paragon points
                $("#suggester").append("<h2>Paragon Suggester</h2>");
                $("#suggester").append('<div id ="paragon1"></div><div id ="paragon2"></div>');
                total.ParagonLevel = result.paragonLevel;
                paragonsuggest(total.ParagonLevel);
                
                var skillname;
                if (typeof mainskillrune !== "undefined"){skillname = mainskillrune;}
                else {skillname = mainskill;}
                
                //and skillspecifictitle by clearing old
                $("#skillspecifictitle").empty();
                //then adding in id
                $("#skillspecific").append('<h2 id ="skillspecifictitle"></h2>');
                //then deciding on correct name
                if (typeof mainskillrune !== "undefined"){
                    $("#skillspecifictitle").append(mainskillrune + '<a href="" title ="The first two columns are just the spell damage %, the second two are spell % + elemental %" onclick="return false;"><sup>*</sup></a>');
                }
                else {
                    $("#skillspecifictitle").append(mainskill + '<a href="" title ="The first two columns are just the spell damage %, the second two are spell % + elemental %" onclick="return false;"><sup>*</sup></a>');
                }

                //Do calculations for main skill
                /*
                $("#skillspecific").append(mainskill + " gets +" + total.Skill + "% skill increase. As " + skillname + ", it's element is " + char.secondary.type + ", and it gets +" +
                total.Elementp[char.secondary.type] + "% damage bonus from " + char.secondary.type + " and it's weapon damage is " + char.secondary.damage + 
                "%." );
                     */
                $("#skillspecific").append(mainskill + " has weapon damage of " + char.secondary.damage + "% and it gets increased by " + total.Skill + "% from skill on gear. As " + skillname + ", it's element is " + char.secondary.type + ", and it gets +" +
                total.Elementp[char.secondary.type] + "% damage bonus from " + char.secondary.type + ".");
        
                var modifydpsby = (char.secondary.damage/100) * (1 + (total.Skill/100)); //ex 393/100 = 3.93 and 1 + 27/100 = 1.27
               
                generatedps("skillspecific", modifydpsby);
                
                equivalency();
                
                //IMPROVE - All below is for figuring out the "improve" column.
                //dpsee is the FINAL dps for elites and elemental. its rift boss dmg, and used for compare.
                var dpsee = ((total.Mindmg + total.Maxdmg)/2) * 
                        total.Bonus *
                        (total.BaseAttackSpeed *
                        (1+(total.AttackSpeed/100))) *
                        (1+((total.Primary)/100)) *
                        (1 + ((total["Damage"]/100)*(total["Chance"]/100))) *
                        ((1 + (total["Elite"]/100)) *
                        (1 + (total["Elementp"][char.secondary.type]/100))) * 
                        ((char.secondary.damage/100) *
                        (1 + (total.Skill/100)));
                
                //for divining best and worst items
                 worstimp = 100;
                 worstid = "";
                 bestimp = 0;
                 bestid = "";
                 
                //for each row
                $("#herotable tr").each(function(a,b){ //a is a count, b is the object
                if (this.id !== "row_header" && this.id !== "row_totals" && this.id !== "row_base"){ //dont do top or bottom rows
                    //duplicate arrays that are getting changed
                    //var changedtotal = total;
                    var changedtotal = jQuery.extend(true, {}, total); //weird syntax for copying but not "merging with the copy" array
                   
                    //set default values of chprim chele chel chskill chchance chdamage chaspd to 0
                    var chprim = chele = chel = chskill = chchance = chdamage = chaspd = 0; 
                    //for each column/cell
                    $(this).find('td').each(function(a,b){
                        if ($(this).context.innerHTML > 0){ //if it has some innerhtml
                            newval = $(this).context.innerHTML;
                            switch (a){ //subtract the value from the appropriate column for the duplicate array
                                case 1:
                                    changedtotal.Primary -= newval;
                                    break;
                                case 2:
                                    changedtotal["Elementp"][char.secondary.type] -= newval;
                                    break;
                                case 3:
                                    changedtotal["Elite"] -= newval;
                                    break;
                                case 4:
                                    changedtotal["Skill"] -= newval;
                                    break;
                                case 5:
                                    changedtotal["Chance"] -= newval;
                                    break;
                                case 6:
                                    changedtotal["Damage"] -= newval;
                                    break;
                                case 7:
                                    changedtotal["AttackSpeed"] -= newval;
                                    break;
                            }//eo switch
                        }//eo if info in table
                    });//eo all tds in the row
                   
                    if (this.id === "row_mainHand"){
                        //console.log("mainhand");
                        changedtotal.Mindmg -= changedtotal.Mainhand.Mindmg; //subtracts the elemental damage and x-x damage
                        changedtotal.Maxdmg -= changedtotal.Mainhand.Maxdmg; //subtracts the elemental damage and x-x damage
                        //console.log(changedtotal.Maxdmg);
                    }
                                                
                    if (this.id === "row_offHand"){
                        changedtotal.Mindmg -= changedtotal.Offhand.Mindmg; //subtracts the elemental damage..
                        changedtotal.Maxdmg -= changedtotal.Offhand.Maxdmg; //subtracts the elemental damage and x-x damage
                    }
                    
                    //find new dps for the row - with big long declaration
                    var changeddps = ((changedtotal.Mindmg + changedtotal.Maxdmg)/2) * 
                        changedtotal.Bonus *
                        (changedtotal.BaseAttackSpeed *
                        (1+(changedtotal.AttackSpeed/100))) *
                        (1+((changedtotal.Primary)/100)) *
                        (1 + ((changedtotal["Damage"]/100)*(changedtotal["Chance"]/100))) *
                        ((1 + (changedtotal["Elite"]/100)) *
                        (1 + (changedtotal["Elementp"][char.secondary.type]/100))) * 
                        ((char.secondary.damage/100) *
                        (1 + (changedtotal.Skill/100)));
                    //find percent change between dps'
                    var changepercent = 100*(dpsee - changeddps)/dpsee;
                    //and convert to two digits
                    changepercent = changepercent.toFixed(2);
                    //and add to this row
                    //console.log(this.id);
                    $("#" + this.id + " td:eq(8)").append(changepercent + "%");
                    //look for best
                    if (parseFloat(changepercent) >= bestimp && parseFloat(changepercent) !== 100 ){ //ignore 2h weapons as best
                        bestimp = changepercent; //assign new top score
                        bestid = this.id; //find name of new top score
                    }
                    //look for worst
                    if (parseFloat(changepercent) <= worstimp){
                        worstimp = changepercent; //assign new top score
                        worstid = this.id; //find name of new top score
                    }
                } //if statement for not top or bottom rows
                }); //eo all rows
                //colorize best and worst items 
                $("#" + worstid + " td:eq(8)").css("color", "#ae191b");
                if (bestid !== ""){
                    $("#" + bestid + " td:eq(8)").css("color", "#59ac5c");
                }
                
                     
                //TODO summarize
                //summarize(); 
                
                //TODO leg bonuses - ideas? when to show in-game stat, when to add in passives, when to add in legendary bonuses
                console.log(legbonuses);
                //new function, parselegbonus - go by name, manual check each one. 
                
                //console.log(allraw);
                     
                     
                //STYLIZING     
                //alternate colors for main table  
                $("#herotable tr:even:not(#row_totals, #row_header)").css("background-color", "#463B32"); //but also if not bottom row, anonymous function?
                
                //highlight top table for other tables, sorta (odd, not top, shouldn't matter but might)
                //$("table:not(#herotable) tr:even").css("background-color", "#463B32"); //bottom light
                $("table:not(#herotable) tr:even").css("background-color", "#1C140D"); //top dark
                
                
                
                //make clearable invisible (in css), then
                //after everything else is done, make it visible, to avoid jumping
                $("#loading").remove();
                $('#clearable').css('visibility', 'visible');
                //and make heroes clickable again
                clickableheroes = true;
                
                
                    
               //TODO LIST:
               
               //X           START sheet damage doesn't match again, set to some basics and figure out why.
                    //X     changed parsetext to ignore default phys damage.
                        //X check WD and 100% seems to be ignoring offhand?
                        //X check WIZ and dps should be 1,131,419, 6% strange crit from conflag passive.
                        //note- was entirely ignoring offhand damage and adding to wrong tables; edited parsetext.
               
               //X.5        "increase" column, Xweapon damage? Xgems? sets? sets would be too hard, deal with it.
               
               //X          change Mindmg in total array, parsetext, and some dps calculations, shouldn't be too hard   
                     
               //X          offhand overwrite option
               //X          if slot == offhand, then duplicate-add to total.Offhand.min and total.Offhand.max - always non-elemental??? use later for button, remove this amount and add button amount
                    //X     ^ done, need to do the button
               
               //X          double-clicking same hero icon, quickly, doesn't clear! no clue how to solve that except maybe a wait function before responding again? or state variable?
               //wait for display of icons until they've changed from default wiz, or no default at all?
               
               //mainskill as option - probably not bother, just do an all-skills thing
               
               //all char display option
               
               //X          Increase! - Contribute? dps with item and dps without item, find difference. 150 dps to 100 dps, (x-y)/x.
               //switch cold and elite in table?
               //not exactly a dps calculator, its a damage per cast calculator. dps is not a useful thing to know, 
                    //but dpm or dprotation would be... HARD
        

               //general stuff from faq...
               //X          passives
               //X          dualwield
               //unique bonuses, ex hexing pants of mr yan :  dmg and regen inc by 25%

               //reforge suggestions - reduce move speed, max stats, trifecta, etc.

               //X          google analytics
               //X          content background image, wait to get final height and make content that height in css
               //X          prettify: buttons, hovers and notes, etc.
               
               //X          how much 1 (or equivalency) more stat would give you in damage.
               
               //X          dps for every skill, not just secondary. change "char" array to "slot" and number them maybe?
               //X.2-hide details        summary at the top and then go into details of items and paragon suggest and etc.
               //X.2-redo for all skills not just mainskill        meteor shower exception, and other weird skills.
               //optimise paragon suggester for point-by-point damage increase.(^ 'equivalency')
               
               //X          Faq, about, contact pages
               
               //get toughness too, make another table/button to load that info? then
                   //suggest torment level to do in group/solo
               //X          make a "getall" function, that gets the raw attributes of all items and just smooshes them together by name, let it
                    //      freely add to the object.
                   
               //X          show an error of some kind if no characters load.



              }                    
          }); //eo get items json                   
       }); //eo each item
    }); //eo get char result json function
} //eo loadchar

//parses text fields for crit chance, damage, intelligence, etc.
function parsetext(field, slot, typeid){
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
    //ATTACK speed on weapons = "Increases attack speed by 7%"
    //already included in weapon damage?!!
    if (parts[0] === "Increases" && parts[1] === "Attack" && parts[2] === "Speed"){
            var aspdasString = parts[4].replace("%", ""); //replace % with space/nothing?
            var aspdasNumber = parseFloat(aspdasString); //convert back to a float
            //total["AttackSpeed"] += (aspdasNumber);
            $("#row_" + slot +  " td:eq(7)").append(aspdasNumber); //7 for aspd
            
            if (slot === "mainHand" || slot === "offHand"){ //or offhand?
                $("#row_" + slot +  " td:eq(7)").css("color", "grey");
            }
    }

    //DAMAGE FLAT part 1 -  elemental, and NOT crit    /*****this is only for elemental damage on weapons, for later patches****             
    if (parts[2] === "Damage" && parts[1] !== "Hit" && parts[0] !== "Increases") // || parts[1] === "Damage" for non elemental
        { //issue with red gems
            //console.log(parts[1]); //weapon's element type might matter in a later patch.. 5.0.2 but not sure?
                //looks like asof 5.0.2 % cold will affect the +cold on weapons so it needs to be added to dps{} separately? or was it already included?
              
             //console.log("ele damage from " + slot); 
              
            var dmgs = parts[0].split("–"); //0 is +min, 1 is max... not a hyphen! weird.
            //10% damage gets caught in this sometimes, so...
            if(dmgs[0].indexOf('%') === -1 && typeof dmgs[1] !== "undefined") //not +10% and not a gem
            {
                var mindmgasString = dmgs[0].replace("+", ""); //remove + from min damage
                var mindmgasNumber = parseFloat(mindmgasString);
                var maxdmgasNumber = parseFloat(dmgs[1]);
                
                total["Mindmg"] += (mindmgasNumber);
                total["Maxdmg"] += (maxdmgasNumber);

                //same as offhand below, saved for editing 
                if (slot === "mainHand"){
                    //console.log(mindmgasNumber);
                    total["Mainhand"]["Mindmg"] += (mindmgasNumber);
                    total["Mainhand"]["Maxdmg"] += (maxdmgasNumber);
                }
                
                //special for offhand, to allow re-editing it.
                if (slot === "offHand"){
                    total["Offhand"]["Mindmg"] += (mindmgasNumber);
                    total["Offhand"]["Maxdmg"] += (maxdmgasNumber);
                }
            }
        }
     
    //DAMAGE FLAT part 2 - only for offhands
    //also need to do for rings and etc, so slot != mainHand or offHand
    //also need to do for red gems
    /*
     *Rule: Non-ele damage doesn't get added to total damage, it's already in there? 
     *unless the item is an orb/quiver/mojo, in which case it's like a ring, with +x-x damage.
     */
    if (parts[1] === "Damage" && parts[1] !== "Hit" && parts[0] !== "Increases" && 
        //(typeid === "Orb" || typeid === "Quiver" || typeid === "Mojo") //AND it's from an offhand item not offhand weapon
        slot !== "mainHand" && (slot !== "offHand" || (typeid === "Orb" || typeid === "Quiver" || typeid === "Mojo")) //is add damage, isn't main, and isnt offhand unless typeid matches.
        ){
         //console.log("non ele damage from " + slot);
        
         var dmgs = parts[0].split("–");
         if(dmgs[0].indexOf('%') === -1 && typeof dmgs[1] !== "undefined") //not +10% and not a gem
            {
                var mindmgasString = dmgs[0].replace("+", ""); //remove + from min damage
                var mindmgasNumber = parseFloat(mindmgasString);
                var maxdmgasNumber = parseFloat(dmgs[1]);
            
                //add to total
                total["Mindmg"] += (mindmgasNumber);
                total["Maxdmg"] += (maxdmgasNumber);
                
                if (slot === "offHand"){ //if offhand, add to oh for table
                    total["Offhand"]["Mindmg"] += (mindmgasNumber);
                    total["Offhand"]["Maxdmg"] += (maxdmgasNumber);
                }
            
            }//eo no gem or 10%
          
        
        //Red Gems in weapons - TODO Gems Fix me later, there are other kinds of undefined out there..
        //it can't go in this section anymore.. there should maybe be a specific "parsegems".
        /*
        if (typeof dmgs[1] === "undefined"){
            total["Mindmg"] += (mindmgasNumber);
            total["Maxdmg"] += (mindmgasNumber); //repeat, re-add min gem amt to max dmg
        }
         */
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
    if ((parts[0] === "Increases") && 
            (parts[1] === mainskill || skname2 === mainskill || skname3 === mainskill || skname4 === mainskill)
        ){ 
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
     
    //parse ALL SKILL damage
    $.each(char, function(count, obj){
        if (parts[1] === obj.name || skname2 === obj.name || skname3 === obj.name || skname4 === obj.name){
            //Copied from above, correct!
            //split by (
            var strparts = field.text.split("(");
            //take last 4 digits
            var last4 = strparts[0].substr(strparts[0].length - 4); // => "Tabs1"
            //remove % sign
            var skillasString = last4.replace("%", "");
            //convert to number
            var skillasNumber = parseFloat(skillasString); 
            this.skill += skillasNumber; //+=?
        }
    });
        //parts[0] === "Increases"
        

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
    //sometimes there is stuff like 10% chance, or 50% chance?
    //runes don't always seem like they change element type but they must, even if they just add ane ffect
    
    //find the percentage and assign to object
    var matches = desc.match(/[0-9]*\.?[0-9]+%/); // regexp to get only the number with %, may need some testing
    if (matches !== null) {
        matches[0] = matches[0].replace("%", "");
        if(parseFloat(matches[0]) >= parseFloat(char[slot].damage)){ //only overwrite if the damage is bigger, for side-effect runes.
            char[slot].damage = matches[0];
            
            //move all element stuff into here, once eval works properly. - no, element still changes even if it's a small effect.
        }
    }
    
    //always shorten desc, to avoid "arcane" power, and the first few lines of costs.
    //if (desc.indexOf("Power") <= 20 && desc.indexOf("Power") !== -1){ //ex "Cost: 20 Arcane Power" <= 20 will give -1 if not there
     desc = desc.substring(20);
    //}
    //assign element type to object
    $.each(total.Elementp, function(element){ //element comes from total array names, just be careful
        if (desc.indexOf(element) >= 1){ //Arcane "Power" is a thing though..
            // was >= 0, but want to skip first word too for skills taht "Fire bolts", "Firebats" or etc.
        //if(desc.indexOf("Power") <= 20) {//not found? Yeah! or at least close enough, 20 chars or so to avoid ones with "power" in cost
            char[slot].type = element;
            //console.log(element + " "+desc.indexOf(element));
        }  
    });
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
    var tpmove = total["Move"]; //was tp1, make it total[move] before paragon and if its anything other than 0, move from gear. 

    while (total["Move"] < 25 && addmove < 50 && tp1 > 0){
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
    if (tpmove !== 0){    //addmove !== 25 && tpmove >= 25){ 
        $("#paragon1").append("You are getting some Move Speed from gear. It's more efficient to get it all from paragon points and reforge gear. ");
    }
    if (addprim > 0){
        $("#paragon1").append("Then spend <span style='color:white; font-weight: bold'>" + addprim + "</span> points in " + primname + ". ");
    }
//$("#paragon1").append("Doing so will give you dps as follows: ");
    //generatedps("paragon1"); //location to output

    //offense - 1% chance = 10% damage
    var addchance = 0; //by .1
    var adddamage = 0; //by 1
    var addspeed = 0; //by .2

    while (tp2 > 0){
        //console.log(total["Chance"] + ' '+ total["Damage"]/10 + ' ' + adddamage + ' ' + tp2);
        if ((total["Chance"] > total["Damage"]/10 || addchance === 50 ) && adddamage < 50 && tp2 > 0){ //small damage and not maxed category and points to spend
            tp2 -= 1;
            total["Damage"] += 1;
            adddamage += 1;
        }
        if ((total["Chance"] <= total["Damage"]/10 || adddamage === 50 ) && addchance < 50 && tp2 > 0){ //small crit or maxed damage, not maxed cat, points to spend addchance 5 b/c div by 10.
            tp2 -= 1;
            total["Chance"] += .1;
            addchance += 1;
        }
        if (addchance === 50 && adddamage === 50 && addspeed < 50 && tp2 > 0){ //other two maxed, points to spend
            tp2 -= 1;
            total["AttackSpeed"] += .2;
            addspeed += 1;
        }
        if (addchance === 50 && adddamage === 50 && addspeed === 50 ) { 
            tp2 = 0; //set to 0 so while loop stops if they have over 150 points.
        } 
    }

    adddamage = adddamage.toFixed(0);
    addchance = addchance.toFixed(0);
    if (adddamage > 0){
        $("#paragon2").append("You should spend <span style='color:white; font-weight: bold'>" + adddamage + "</span> points in Critical Hit Damage. ");
    }
    if (addchance > 0){
        $("#paragon2").append("You should spend <span style='color:white; font-weight: bold'>" + addchance + "</span> points in Critical Hit Chance. ");
    }  
    if (addspeed > 0){
        $("#paragon2").append("<span style='color:white; font-weight: bold'>" + addspeed + "</span> points should go into Attack Speed. ");
    }
    $("#paragon2").append("<br>Spending your points this way will give you dps as follows:"); 
   // $("#paragon2").append("<a href='' title ='The base value in this table should be your sheet dps in-game. If not, it&#39;s Blizzard&#39;s fault with incorrect offhand damage.' onclick='return false;'><sup>*</a></sup>");
    generatedps("paragon2");
}

function generatedps(location, a){ //generates the tables
    a = typeof a !== 'undefined' ? a : 1; //if a is given, use it, otherwise use 1. optional parameter for spells

    $("#" + location).append("<br>"); //spacing 
    
    //this won't work if there is some other flat damage, like rings... but fixed the weird issue anyway so all is good!
    //var truemin = (total.Mainhand.Mindmg + total.Offhand.Mindmg);
    //var truemax = (total.Mainhand.Maxdmg + total.Offhand.Maxdmg);
    //var avgdmg = (truemin + truemax)/2;
    
    var avgdmg = (total.Mindmg + total.Maxdmg)/2;
    var pass = total.Bonus; //bonus from passives and skills
    var aspd = total.BaseAttackSpeed *(1+(total.AttackSpeed/100)); //1.4 * 1.3 correct  //sb total.BaseAttackSpeed
    var prim = 1+((total.Primary)/100); 
    var tcrit = 1 + ((total["Damage"]/100)*(total["Chance"]/100));
    var dps = {}; //create dps array
    
    //avgdmg = 2099.5; //for testing sorc2
    
    /*
    var min = 2208;
    var max = 2894;
    console.log((min+max)/2);
    */
    
    //console.log("avg = " + avgdmg + " aspd = " + aspd +  " prim = " + prim +  " totcrit = " +tcrit + " critd/critc = " + total.Damage + " " + total.Chance);                         
    
    //console.log(dps);

    dps.Base = avgdmg * pass * aspd * prim * tcrit * a; //a is a special multiplier
    dps.Elite = dps.Base * (1 + (total["Elite"]/100));
    dps.Elemental = dps.Base * (1 + (total["Elementp"][char.secondary.type]/100)); //get only spender's element
    dps.EliteElemental = dps.Base * (1 + (total["Elite"]/100)) * (1 + (total["Elementp"][char.secondary.type]/100));

/*
    var given = 1067451;
    var supposed = 1132987;
    var diff = supposed-given; //2^16...
    console.log(diff);
    var perc = ((diff/given)*100)/given;
    console.log(perc); //.0000005...
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



function changeOffhand(){ //changes offhand value and reruns code
    
    //ask for new values
    var textvalue = prompt("Please enter your offhand damage.","100-200");
    values = textvalue.split("-");
    var newohmin = parseFloat(values[0]);
    var newohmax = parseFloat(values[1]);
    if (newohmin > 0 && newohmax > 0){ //if they aren't undefined or letters or weird things
        //will re-run data as normal. new oh.mindmg needs to be +new and - old, no base.
        total.Offhand.Mindmg = -total.Offhand.Mindmg + newohmin; //-old, +new
        total.Offhand.Maxdmg = -total.Offhand.Maxdmg + newohmax;;
        
        //only change flag if the prompt is valid
        offhandflag = 1; //global, now set to 1 for conditionals in total
        //rerun everything.
        loadchar(g_id);
    }
    else {
        alert("Invalid.");
    }
}

//get allraw, useful for gold find, exp, pickup, maybe resource?
function getAllRaw(rawobj, slot){
    //allraw is an object
    $.each(rawobj, function(i, textfield){
        allraw[i] = {}; //populate all raw with the names of objects, only if allraw[i][j] is undefined?
        $.each(textfield, function(minmax, value){
            
            if (typeof allraw[i][minmax] === "undefined"){ //first time?
                allraw[i][minmax] = value;
            }
            if (typeof allraw[i][minmax] !== "undefined"){ //other than first time?
                allraw[i][minmax] += value;
            }
            
            //allraw[i][minmax] = value;
                
            //console.log(slot + " gives " + i + " " + minmax + " " + value);
        });
    });
    
}

function equivalency(output, skip){ 
    $("#equivs").append('<h2 id ="equivtitle">Equivalencies</h2>');
    //FINAL 120 flat = 500 prim = 20 ele = 15 skill/elite = 6 chance = 50 damage = 7 ias
    var equivs = [120,500,20,15,15,6,50,7];  //must stay in this order          
                
    var avgdmg = (total.Mindmg + total.Maxdmg)/2;
    var pass = total.Bonus; //bonus from passives and skills
    var aspd = total.BaseAttackSpeed *(1+(total.AttackSpeed/100)); //1.4 * 1.3 correct  //sb total.BaseAttackSpeed
    var prim = 1+((total.Primary)/100); 
    var tcrit = 1 + ((total["Damage"]/100)*(total["Chance"]/100));
    var elite = (1 + (total["Elite"]/100));
    var ele = (1 + (total["Elementp"][char.secondary.type]/100));
    var a = (char.secondary.damage/100) * (1 + (total.Skill/100)); // this is a from generatedps 
    
    var base = avgdmg * pass * aspd * prim * tcrit * elite * ele * a;
        /* 
        console.log(aspd);
        aspd = 1; //needs to go above "var base" for retesting
        console.log(base/avgdmg); //if you didnt have your flat damage - 14k 9.5
        console.log(base/prim); //if you dindt have any primary - 303k 202
        console.log((base/prim)/avgdmg); //if you didnt have either - 185.. 123.. all are 2/3s, so true aspd makes no difference.
        */
    var dps = {}; //create dps array
    
    //dps.Base = avgdmg * pass * aspd * prim * tcrit * elite * ele * a; //a is a special multiplier for skill*skilleffect
    dps.Damage = (base / avgdmg) * ((total.Mindmg+80) + (total.Maxdmg+160))/2;
    dps.Primary = (base / prim) * (1+((total.Primary+500)/100)); //add 500
    dps.Elemental = (base /ele * (1 + ((total["Elementp"][char.secondary.type]+20)/100)));
    dps.Elite = (base / elite) * (1 + ((total["Elite"]+15)/100));
    dps.Skill = (base / a ) * (char.secondary.damage/100) * (1 + ((total.Skill+15)/100));
    dps.CritChance = (base / tcrit ) *  (1 + ((total["Damage"]/100)*((total["Chance"]+6)/100))); //remove tcrit, times by old damage and by new chance
    dps.CritDamage = (base / tcrit ) *  (1 + (((total["Damage"]+50)/100)*((total["Chance"])/100))); //^
    dps.ASpeed = (base / aspd) * (total.BaseAttackSpeed *(1+((total.AttackSpeed+7)/100))); 
    
    var location = "equivs";
    var examplevalue = (((dps.Primary-base)/base)*100).toFixed(2);
    
    $("#equivs").append("This is the % damage increase you would see by adding the equivalent amount of each stat (based on \n\
approximate amounts available in gear slots). Ex. Increasing your Primary stat by " + equivs[1] + " would increase your damage by \n\
" + examplevalue + "%."); 
    
    //create a table
    $("#" + location).append("<table class = 'dps' id = 'table" + location + "'>");
    
    $("#table" + location).append("<tr id ='" + location + "header'>"); //open header row
    //display header
    $.each(dps, function(name){ //fill the header row
        $("#" + location + "header").append("<td>"+name+"</td>");
    });
    $("#table" + location).append("</tr>"); //close header row
    
    $("#table" + location).append("<tr id ='equivvalues'>"); //open equiv values row
    //display each value
    $.each(equivs, function(name, value){
        //append to table - equivs
        $("#equivvalues").append("<td>"+value+"</td>");
    });
     $("#table" + location).append("</tr>"); //close values row

    $("#table" + location).append("<tr id ='equivpercents'>"); //open percents row
    //display each dps
    $.each(dps, function(name, value){
        //convert to percent increase over base damage
        value = (((value - base)/base)*100).toFixed(2);
        //value = ((value/base)).toFixed(2); //used to be this, 1.0x% mostly, harder to read.
        //append to table - percents
        $("#equivpercents").append("<td>"+value+"%</td>");
    });
    $("#table" + location).append("</tr>"); //close percents row
    
    $("#" + location).append("</table>"); //close table
    
    //highlight best percent.
    bestequivloc = 0;
    bestequiv = 0;
    var value;
    //go through each td
    $("#equivpercents td").each(function(a){
                value = (this.innerHTML).replace("%","");
                value = parseFloat(value);
                if (value > bestequiv){
                    bestequiv = value;
                    bestequivloc = a;
                }
    });
    //green-ify the best one
    $("#equivpercents td:eq(" + bestequivloc + ")").css("color", "#59AC5C");
    $("#equivsheader td:eq(" + bestequivloc + ")").css("color", "#59AC5C");
    //also grey-ify all standard values
    $("#equivvalues").css("color", "grey");
    
    
}


function summarize(){
    $("#hero").before("<div id = 'summary'></div>"); //create new div for stuff to go in
    $("#summary").append("<h2>Summary for " + heroname + "</h2>");
    //TODO add character's name to ^ G-name?
    
    var avgdmg = (total.Mindmg + total.Maxdmg)/2;
    var pass = total.Bonus; //bonus from passives and skills
    var aspd = total.BaseAttackSpeed *(1+(total.AttackSpeed/100)); //1.4 * 1.3 correct  //sb total.BaseAttackSpeed
    var prim = 1+((total.Primary)/100); 
    var tcrit = 1 + ((total["Damage"]/100)*(total["Chance"]/100));
    var base = avgdmg * pass * aspd * prim * tcrit;
    
    var dps = {}; //create dps array
 
    //TODO log final damages
        $.each(char, function(count, value){
            if (value.type !== 0 && typeof value.name !== "undefined"){
                var newbase = base; 
                newbase = newbase * (value.damage/100); //times by new damage
                newbase = newbase * (1 + (value.skill/100)); //times by skill
                newbase = newbase * (1 + (total["Elementp"][value.type]/100)); //times by element
                newbase = newbase * (1 + (total["Elite"]/100)); //times by elite
                
                //shorten to 0 decimals
                newbase = (Math.round(newbase*100)/100).toFixed(0);
                //add commas
                newbase = newbase.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                
                //This is correct, missing "odd" statements like the customized patch 2.0.5 element changes and meteor.
                //console.log(value.name + " does " + newbase + " damage per second.");
                dps[value.name] = newbase;
            }
        });
    
    var location = "summary";
    var count = 0; //need to do manually, using name as id falls apart with spaces.
    
    //create a table
    $("#" + location).append("<table id = 'table" + location + "'>");
    
        $.each(dps, function(name, value){
            $("#table" + location).append("<tr id ='skill" + count + "'>");
            
            //conversion required for name to slug, lower case and - not spaces.
            var slug = name.toLowerCase();
            slug = slug.replace(" ", "-");
            $("#skill" + count).append("<td><a href='http://" + g_host + ".battle.net/d3/en/class/" + classname + "/active/" + slug + "' onclick='return false;'>" + name + "</a><td>");
                        
            $("#skill" + count).append("<td>"+value+"</td>");

            $("#table" + location).append("</tr>");
            count++;

        });
    //close table    
    $("#" + location).append("</table>"); //close table
}






//clear all output
function clearoutput(special){
    //clear all output
    $("#clearable").html('');
    //and clear heroes header
    $("#h2heroes").remove();
    //then re-add top-level divs
    $("#clearable").append('<div id = "hero"></div>');
    $("#clearable").append('<div id = "output"></div>');
    $("#clearable").append('<div id = "suggester"></div>');
    $("#clearable").append('<div id = "skillspecific"></div>');
    $("#clearable").append('<div id = "equivs"></div>');
    
    //OLD clear text in output
    //$("#output").html('');
    // these are getting double added now $("#output").append('<div id ="outputact"> </div><div id ="outputpass"> </div><div id ="outputrune"> </div>'); //reappend the styling for skill tooltips
    //$("#skillspecific").html('');
    // this never needs to be a palceholder $("#skillspecific").append('<h2 id ="skillspecifictitle">Skill Specific<a href="" title ="The first two columns are just the spell damage %, the second two are spell % + elemental %" onclick="return false;"><sup>*</sup></a></h2>');
    //$("#equivs").html('');
    //$("#equivs").append('<h2 id ="equivtitle">Equivalenices</h2>');
    //$("#summary").html('');
    
    //reset main combat skills. blank wont work so reset is a specific term used later
    genskill = mainskill = "reset";
    
    //if (special !== "offhand"){ //if not offhand, clear. save them if it is
        $("#paragon1").html('');
        $("#paragon2").html('');
        //clear table
        $("#herotable").find("tr:gt(0)").remove(); 
        $("#hero").find("p").remove();
    //}
    
    
}

//ON DOM LOAD
$(document).ready(function() { 
    //handles the profile click/submit event
    $('#submitprof').click(function() {
        loadprofile($('#host').val(), $('#name').val(), $('#code').val() );
    }); 
    //press enter on number to submit
    $("#code").keyup(function(event){
    if(event.keyCode === 13){ //enter
        $("#submitprof").click();
    }
    });
    //or on name
    $("#name").keyup(function(event){
    if(event.keyCode === 13){ //enter
        $("#submitprof").click();
    }
    });
    
});


