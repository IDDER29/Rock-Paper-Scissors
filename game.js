//The function that holed the game 
function game(){

    // defined the items of the game

    let items = ['Rock', 'Paper', 'Scissors'];

    //the varables that hold the Score of the game

    let computer = 0;
    let player = 0;

    //the loop that keep the game has 5 rounds 

    for(let i=0; i<5 ; i++){
       
        //the function that make the computer take an item to play it 

        function getComputerChoice() {
        
            let randomNumber = Math.floor(Math.random() * items.length);
            
            let computerSelection = items[randomNumber];
            return computerSelection;
        }
        
        //the function that get what the player choice 

        function getPlayerSelection(){
            let playerSelectionA = prompt('Unleash your choice! Will it be the mighty Rock, the versatile Paper, or the cunning Scissors?');
            let playerSelection = playerSelectionA[0].toUpperCase() + playerSelectionA.trim().slice(1).toLocaleLowerCase();

            //A loop that veryfy if the input is one of the items of the game if not it kepps looping untily the user input a corect item

            while(!(items.includes(playerSelection))){
                playerSelectionA = prompt("Oops! It seems you didn't choose any of the options we provided, or there might have been a typo. Please try again and select either Rock, Paper, or Scissors:");
                
                playerSelection = playerSelectionA[0].toUpperCase() + playerSelectionA.trim().slice(1).toLocaleLowerCase();
            }
            
           return playerSelection;
            
            
        }

        //function that deside what is the resole of the round

        function referee(playerSelection, computerSelection){

            
            let result;

            if((computerSelection == items[0] && playerSelection == items[0]) || (computerSelection == items[1] && playerSelection == items[1]) || (computerSelection == items[2] && playerSelection == items[2])  ) {
                result = `Round ${i + 1} comes to a draw, and now we're all just staring at each other with rocks, paper, and scissors in our hands`;
                console.log(result);
            }else if ((computerSelection == items[0] && playerSelection == items[1]) || (computerSelection == items[1] && playerSelection == items[2]) || (computerSelection == items[2] && playerSelection == items[0])  ) {
                result = `You crushed it like a ${playerSelection} smashing ${computerSelection}! Victory is yours!`;
                player++;
                console.log(result);
            }else {
                result =  `Oh no! Your ${playerSelection} got crushed by the mighty ${computerSelection}! Better luck next time! `;
                computer++;
                console.log(result);
                
                
            }
           
        }
        
        
        const playerSelection = getPlayerSelection();
        const computerSelection = getComputerChoice();
        console.log(referee(playerSelection, computerSelection));
        
        
    }

    //this step to veryfy and declary the score and tell who is the winner of the game 

    if(computer > player){
        console.log(`You lost: computer ${computer} and you ${player}`)
    }else if(computer < player){
        console.log(`You win: computer ${computer} and you ${player}`)
    }else{
        console.log(`it's a draw : computer ${computer} and you ${player}`)
    }
    

}

game();