import math

class WebCharacter:
    def __init__(self,name,ac,max_hp,speed,pb):

        # General stats
        self.name = name
        self.max_hp = max_hp
        self.pb = pb
        self.ac = ac
        self.speed = speed

        # # ability score - int values
        self.stre= 0
        self.dex = 0
        self.con = 0
        self.inte = 0
        self.wis = 0
        self.cha= 0

        # ----------REST ----------------------

        self.temp_hp = 0
        self.hp = self.max_hp
        self.hit_dice = self.max_hit_dice
        self.lvl=1
        
        
        self.initiative = 0
       
        self.atk =0
        self.sp_atk= 0
        self.DC =0
        self.max_prepered_spells = 2
        self.reaction = True
        
        self.long_rest_abilities=[]
        self.gold = 0
        
        self.notes = []

        self.max_hit_dice = 0
        self.inspiration = 0

        self.inventory = {
            'Tool':[],
            'Armor':[],
            'Weapon':[],
            'Consumable':[],
            'Wondrous':[],
            'Other':[],
            'Potion':[],
            'Scroll':[],
            'Ring':[]     
        }

        self.spells_known = {
            'cantrip':[],
            'tier1':[],
            'tier2':[],
            'tier3':[],
            'tier4':[],
            'tier5':[],
            'tier6':[],
            'tier7':[],
            'tier8':[],
            'tier9':[]
        }
        
        self.spells_prepared = {}

        self.feats_traits = []

        self.spell_tiers = {'cantrip':0,'tier1':1,
                            'tier2':2,'tier3':3,
                            'tier4':4,'tier5':5,
                            'tier6':6,'tier7':7,
                            'tier8':8,'tier9':9}
        
        self.spell_slots = {'tier1':{'max':0,'current':0},
                            'tier2':{'max':0,'current':0},
                            'tier3':{'max':0,'current':0},
                            'tier4':{'max':0,'current':0},
                            'tier5':{'max':0,'current':0},
                            'tier6':{'max':0,'current':0},
                            'tier7':{'max':0,'current':0},
                            'tier8':{'max':0,'current':0},
                            'tier9':{'max':0,'current':0}
                            }
        self.ability_scores ={'Strength':'stre',
                'Dexterity':'dex',
                'Constitution':'con',
                'Inteligence':'inte',
                'Wisdom':'wis',
                'Charisma':'cha'}    
    
        self.saving_throws = {
                'stre':False,
                'dex':False,
                'con':False,
                'inte':False,
                'wis':False,
                'cha':False}
        
        self.skills = {'Acrobatics': [False,'Dexterity'],
                        'Animal Handling': [False,'Wisdom'],
                        'Arcana': [False,'Inteligence'],
                        'Athletics': [False,'Strength'],
                        'Deception': [False,'Charisma'],
                        'History': [False,'Inteligence'],
                        'Insight': [False,'Wisdom'],
                        'Intimidation': [False,'Charisma'],
                        'Investigation': [False,'Inteligence'],
                        'Medicine': [False,'Wisdom'],
                        'Nature': [False,'Inteligence'],
                        'Perception': [False,'Wisdom'],
                        'Performance': [False,'Charisma'],
                        'Persuasion': [False,'Charisma'],
                        'Religion': [False,'Inteligence'],
                        'Sleight of Hand': [False,'Dexterity'],
                        'Stealth': [False,'Dexterity'],
                        'Survival': [False,'Wisdom']
                        }
    
        #---------- init end ----------------


    def ability_mod(self,ability):
        mod_str = self.ability_scores[ability]
        mod = getattr(self,mod_str)
        if mod >= 10:
            mod = int((mod-10)/2)
            return mod   
        elif mod < 10:
            mod = int((mod-10)/2 -0.5)
            return mod 

    def spend_slot(self,tier):
        self.spell_slots[tier]['current'] -=1
        if self.spell_slots[tier]['current'] <= 0:
            self.spell_slots[tier]['current'] = 0
        
    def regain_slot(self,tier):
        self.spell_slots[tier]['current'] +=1
        if self.spell_slots[tier]['current'] > self.spell_slots[tier]['max']:
            self.spell_slots[tier]['current'] = self.spell_slots[tier]['max']

    def add_spellslot(self,slot,amount):
        self.spell_slots[slot]['max'] += amount
        
    def take_short_rest(self):
        for skill in self.feats_traits:
            if skill['reset'] == 'Short Rest' and skill['charges'] != None:
                skill['charges']['current'] = skill['charges']['max']

    def take_long_rest(self):
        self.hp = self.max_hp
        self.temp_hp = 0
        self.hit_dice += math.ceil(self.max_hit_dice / 2)
        if self.hit_dice > self.max_hit_dice:
            self.hit_dice = self.max_hit_dice

        for tier in self.spell_slots.values():
            tier['current'] = tier['max']

        for skill in self.feats_traits:
            if skill['reset'] != None and skill['charges'] != None:
                skill['charges']['current'] = skill['charges']['max']

    def addspell(self,name,tier,components,innate,
                 srange,duration,action,concentration,
                 text,school):
        
        spell = {
            'name':name,
            'components':components,
            'innate':innate,
            'range':srange,
            'duration':duration,
            'action':action,
            'concentration':concentration,
            'text':text,
            'school':school
            }
        
        self.spells_known[tier].append(spell)
        

    # not correct atm
    def damage(self,entry): 
        dmg_diff = self.temp_hp - entry
        if dmg_diff < 0:
            self.temp_hp = 0
            self.hp += dmg_diff
        else:
            self.temp_hp -= entry

        if self.hp < 0:
            self.hp = 0
        
    def heal(self,entry):
        heal = entry
        self.hp += heal
        if self.hp > self.max_hp:
            self.hp = self.max_hp
    
    def spend_hit_dice(self):
        self.hit_dice -= 1
        if self.hit_dice < 0:
            self.hit_dice = 0
            return 'no more hit dice left'
        self.heal(5)

    def add_temp_hp(self,entry):
        self.temp_hp += entry

    def live_buttons_tag(self):
        return {'Gold':'gold',
                'Hp':'hp',
                'Hit Dice': 'hit_dice'}

    def other_stats(self):
        return {
            'Name':'name',
            'Max Hp':'max_hp',
            'Max Hit Dice':'max_hit_dice',
            'Total level':'lvl',
            'Prof. Bonus':'PB', 
            'AC':'AC', 
            'Initiative':'initiative', 
            'Speed':'speed', 
            'Attack':'atk', 
            'Spell Attack':'sp_atk',
            'Save DC':'DC', 
            'Max spells prepared':'max_prepered_spells',
            'Inspiration':'inspiration'
        }
    
    def save_stats(self):
        all_stats = {**self.other_stats(),**self.ability_scores}
        all_stats['Hp'] = 'hp'
        all_stats['Hit Dice'] = 'hit_dice'
        all_stats['Temp Hp'] = 'temp_hp'
        all_stats['Gold'] = 'gold'
        return all_stats
   
    def combat_stats(self):
        return {'AC':'AC', 
                'Save DC':'DC',
                'Attack':'atk',
                'Spell Attack':'sp_atk',
                'Initiative':'initiative',
                'Speed':'speed' }

if __name__=='__main__':
    char = WebCharacter()
    
    