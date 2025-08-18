from random import randint 


def roll_dice(size:int,modifier: int, roll_type:bool=None) -> int:
    if roll_type == None:
        return randint(1, size) + modifier
    
    if roll_type == False:
        roll1 = randint(1, size) + modifier
        roll2 = randint(1, size) + modifier
        return min(roll1,roll2)
        

    if roll_type == True:
        roll1 = randint(1, size) + modifier
        roll2 = randint(1, size) + modifier
        return max(roll1,roll2) 


if __name__=="__main__":
    roll = roll_dice(20,3,roll_type=None)
    print(roll)