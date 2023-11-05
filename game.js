$(function(){
    $("#header").load("header.html");
    $("#footer").load("footer.html");
  });
  /*
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

game(); */


// defined the items of the game

let items = ['Rock', 'Paper', 'Scissors'];

const RockBtn = document.querySelector('.rock');
const PaperBtn = document.querySelector('.paper');
const ScissorsBtn = document.querySelector('.scissors');

let comment = document.querySelector('.result-comment')
let playerScore = document.querySelector('#player-score');
let computerScore = document.querySelector('#computer-score')

let QuestionMark = document.querySelector('#question-mark');

let clonedRock = RockBtn.cloneNode(true);
let clonedPaper = PaperBtn.cloneNode(true);
let clonedScissors = ScissorsBtn.cloneNode(true);

//the varables that hold the Score of the game

let computer = 0;
let player = 0;

//the function that make the computer take an item to play it 

function getComputerChoice() {
        
    let randomNumber = Math.floor(Math.random() * items.length);
    
    let computerSelection = items[randomNumber];

    QuestionMark.removeChild(QuestionMark.firstElementChild);
    if(randomNumber == 0){
        QuestionMark.appendChild(clonedRock);
    } else if(randomNumber == 1){
        QuestionMark.appendChild(clonedPaper);
    }else{
        QuestionMark.appendChild(clonedScissors);
    }
   
    
    return computerSelection;
}
// Get the gameScore for the player and the computer

let gameScoreP = document.querySelector('.gamescorePL');
let gameScoreC = document.querySelector('.gamescoreCM');

let playerScorePnt = 0;
let computerScorePnt = 0;
//function that deside what is the resole of the round
let i = 0;
function referee(playerSelection, computerSelection){

            
    let result;
    

    if((computerSelection == items[0] && playerSelection == items[0]) || (computerSelection == items[1] && playerSelection == items[1]) || (computerSelection == items[2] && playerSelection == items[2])  ) {
        result = `Round ${i+1} comes to a draw, and now we're all just staring at each other with rocks, paper, and scissors in our hands`;
        comment.textContent = result;
    }else if ((computerSelection == items[0] && playerSelection == items[1]) || (computerSelection == items[1] && playerSelection == items[2]) || (computerSelection == items[2] && playerSelection == items[0])  ) {
        result = `You crushed it like a ${playerSelection} smashing ${computerSelection}! Victory is yours!`;
        player++;
        comment.textContent = result;
    }else {
        result =  `Oh no! Your ${playerSelection} got crushed by the mighty ${computerSelection}! Better luck next time! `;
        computer++;
        comment.textContent = result;
        
        
    }
    i++;

    playerScore.textContent = player;
    
    computerScore.textContent = computer;

    // Get the modal
let modal = document.getElementById("myModal");

// Get the <span> element that closes the modal
let span = document.getElementsByClassName("close")[0];

// Get the <p></p> element that show the result comment 
let p = document.querySelector('#result');

// Get the 'Continue' button
let continueButton = document.getElementById("continue");





// When the user reaches 5 points, open the modal
if (player == 5 || computer == 5) {
    i = 0;
  modal.style.display = "block";
  if(player === 5){
    playerScorePnt++;
    gameScoreP.textContent = playerScorePnt;
    p.textContent ='You are the champion! You have crushed your opponents and claimed the glorious prize! You deserve a round of applause and a standing ovation! Bravo! 🎉👏👏👏';
    
  }else{
    computerScorePnt++;
    gameScoreC.textContent = computerScorePnt;

    p.textContent = 'You lost, noby! But at least you had fun, right?';
    
  }
}

// When the user clicks on <span> (x), close the modal
span.onclick = function() {
  modal.style.display = "none";
}

// When the user clicks on 'Continue', close the modal
continueButton.onclick = function() {
  modal.style.display = "none";
 
  // Add code here to continue the game
  computer=0;
  player = 0;
  playerScore.textContent = player;
    
    computerScore.textContent = computer;
}

    

    //this step to veryfy and declary the score and tell who is the winner of the game 

    

    return result;
  
}


let playerSelection ;
let computerSelectio;






RockBtn.addEventListener('click', function(){
    computerSelection = getComputerChoice();
    playerSelection = 'Rock';
    referee(playerSelection, computerSelection);
})

PaperBtn.addEventListener('click', function(){
    computerSelection = getComputerChoice();
    playerSelection = 'Paper';
    referee(playerSelection, computerSelection);
})

ScissorsBtn.addEventListener('click', function(){
    computerSelection = getComputerChoice();
    playerSelection = 'Scissors';
    referee(playerSelection, computerSelection);
})


/*
function game(){

    // defined the items of the game

    let items = ['Rock', 'Paper', 'Scissors'];

    //the varables that hold the Score of the game

    let computer = 0;
    let player = 0;

    //the loop that keep the game has 5 rounds 

    for(let i=0; i<5 ; i++){
       
      
        
        
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

game(); */