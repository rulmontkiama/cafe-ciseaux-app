export interface Schedule {
    dimanche: string;
    lundi: string;
    mardi: {
      start1: string;
      end1: string;
      isBook:boolean;
      start2?: string;
      end2?: string;
    };
    mercredi: {
      start1: string;
      end1: string;
      isBook:boolean;
      start2?: string;
      end2?: string;
    };
    jeudi: {
      start1: string;
      end1: string;
      isBook:boolean;
      start2?: string;
      end2?: string;
    };
    vendredi: {
      start1: string;
      end1: string;
      isBook:boolean;
      start2?: string;
      end2?: string;
    };
    samedi: {
      start1: string;
      end1: string;
      isBook:boolean;
      start2?: string;
      end2?: string;
    };
  }
