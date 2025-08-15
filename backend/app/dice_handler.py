from random import randint 


def roll_dice(size:int,modifier: int) -> int:
    return randint(1, size) + modifier


if __name__=="__main__":
    roll = roll_dice(20,3)
    print(roll)