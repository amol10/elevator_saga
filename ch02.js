{
    init: function(elevators, floors) {
        var elevator = elevators[0]; // Let's use the first elevator
        var idle = true;
        var waiting_floors = [];

        // Whenever the elevator is idle (has no more queued destinations) ...
        elevator.on("idle", function() {
            // let's go to all the floors (or did we forget one?)
            idle = true;
            console.log("on idle");
            //if (elevator.getPressedFloors().length > 0) {
            //    handle_call("");
            //}
            handle_call("", -1);
        });
        
        for (i=0; i < floors.length; i++) {
            fl = floors[i];
            fl.on("up_button_pressed", function() {
                handle_call("up", this.floorNum());
            });
        
            fl.on("down_button_pressed", function() {
                handle_call("down", this.floorNum());
            });
        }
        
        function handle_call(dir, floorNum) {
            if (idle) {
                if (floorNum == -1) {
                    if (waiting_floors.length > 0) {
                        floorNum = waiting_floors.shift();
                    } else {
                        return;
                    }                     
                }          
                idle = false;
                elevator.goToFloor(floorNum);
            } else {
                waiting_floors.push(floorNum);
                console.log("waiting floor ", floorNum);
            }   
        };
        
        elevator.on("floor_button_pressed", function(floorNum) {
            // Maybe tell the elevator to go to that floor?
            elevator.goToFloor(floorNum)
        })
    },
                
    update: function(dt, elevators, floors) {
        // We normally don't need to do anything here
    }
}
