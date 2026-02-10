<?php
        //serve(['da_user'=>['all']]);

        set(
            'da_user',
            [
                'name'=>[],
                'password' => [],
                'address'=>[],
                'city'=>[],
                'mail'=>[],
                'phone'=>[],
            ], 
            [$data],
            'POST'
        );
        ?>